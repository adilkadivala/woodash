# Backend Architecture: MCP Gateway Platform

Scope: the **gateway backend**, the **WooCommerce MCP server**, and the **extra upstream MCP servers**.
Stack assumed: TypeScript, Node 20, Fastify, Postgres, `@modelcontextprotocol/sdk`.

---

## 1. System overview

```
 MCP client (Claude Code / Inspector)         Dashboard (React)
        | Bearer API key                          | session cookie
        v                                         v
 +----------------------- Gateway backend -----------------------+
 |  POST /mcp  (Streamable HTTP, stateless)   /api/*  (REST)     |
 |        |                                      |               |
 |        +-------------> Auth <-----------------+               |
 |                          | Principal {userId, role, via}      |
 |   Chat agent ------------+  (acts as the logged-in user)      |
 |                          v                                    |
 |          +--- executeTool (the ONLY call path) ---+           |
 |          | policy -> route -> timeout -> breaker  |           |
 |          | -> upstream call -> audit (finally)    |           |
 |          +------------------+---------------------+           |
 |   Upstream manager: one MCP client per server,                |
 |   health loop, tool cache + digest                            |
 +--------------+----------------------------+-------------------+
                v                            v
          Postgres                  Upstream MCP servers (ClusterIP only)
   (users, keys, servers, audit)    woo-mcp | utils-mcp | notes-mcp
                                        |
                                 WooCommerce REST API
                                 -> WordPress + MySQL
```

**Core design rule:** the external MCP endpoint, the chat agent and the dashboard all converge on one function, `executeTool`. Revocation, disable, dead-upstream isolation and audit attribution are then enforced in exactly one place.

---

## 2. Repository layout (backend)

```
woocommerce/
├── server/
│   ├── src/
│   │   ├── index.ts              # boot: config -> db -> migrate -> seed -> upstream manager -> server
│   │   ├── config.ts             # env parsing (zod); fail fast on missing secrets
│   │   ├── server.ts             # Fastify app, plugins, route registration
│   │   ├── seed.ts               # bootstrap admin + pre-register the Woo upstream
│   │   │
│   │   ├── db/
│   │   │   ├── client.ts         # pg pool
│   │   │   ├── migrations/       # 001_init.sql, 002_policies.sql ...
│   │   │   └── repos/            # users, keys, servers, audit, chat (plain SQL functions)
│   │   │
│   │   ├── auth/
│   │   │   ├── passwords.ts      # argon2/bcrypt for human passwords
│   │   │   ├── sessions.ts       # cookie session create/verify
│   │   │   ├── apiKeys.ts        # generate, sha256 hash, verify, revoke
│   │   │   ├── principal.ts      # Principal { userId, role, via }
│   │   │   └── middleware.ts     # requireSession, requireApiKey, requireRole('admin')
│   │   │
│   │   ├── upstream/
│   │   │   ├── manager.ts        # owns all upstream clients; add/update/remove/disable
│   │   │   ├── client.ts         # MCP client per upstream (Streamable HTTP + auth header)
│   │   │   ├── health.ts         # background loop: status, lastError, lastCheckedAt
│   │   │   ├── breaker.ts        # per-upstream circuit breaker (closed/open/half-open)
│   │   │   └── digest.ts         # hash tool declarations; flag changes
│   │   │
│   │   ├── aggregator/
│   │   │   ├── listTools.ts      # parallel fan-out, per-upstream timeout, allSettled
│   │   │   ├── naming.ts         # slug__tool encode/decode
│   │   │   └── router.ts         # namespaced name -> upstream + original tool
│   │   │
│   │   ├── executor/
│   │   │   └── executeTool.ts    # THE single path
│   │   │
│   │   ├── policy/
│   │   │   ├── engine.ts         # (principal, server, tool) -> allow/deny, default deny
│   │   │   └── rules.ts          # role rules (bonus: DB-backed per-tool rules)
│   │   │
│   │   ├── audit/audit.ts        # write row in finally; args hashed, never raw
│   │   │
│   │   ├── mcp/
│   │   │   ├── endpoint.ts       # POST /mcp, stateless, API-key auth
│   │   │   └── handlers.ts       # initialize, ping, tools/list, tools/call
│   │   │
│   │   ├── chat/
│   │   │   ├── agent.ts          # LLM tool loop with caps + repeat detection
│   │   │   ├── llm.ts            # provider adapter, key from env
│   │   │   ├── toolBridge.ts     # MCP tool schema -> LLM function declarations
│   │   │   └── stream.ts         # SSE helpers
│   │   │
│   │   ├── security/
│   │   │   ├── ssrf.ts           # validate upstream URLs before save/connect
│   │   │   ├── crypto.ts         # AES-GCM encrypt/decrypt upstream credentials
│   │   │   ├── redact.ts         # strip secrets from logs and errors
│   │   │   └── rateLimit.ts      # per-key limiter (bonus)
│   │   │
│   │   └── routes/
│   │       ├── auth.ts  members.ts  keys.ts  servers.ts
│   │       └── tools.ts audit.ts    chat.ts  health.ts
│   ├── test/                     # executor, aggregator, policy, key hashing, SSRF
│   ├── Dockerfile                # multi-stage, non-root user
│   └── package.json
│
├── woo-mcp/
│   ├── src/
│   │   ├── index.ts              # MCP server, Streamable HTTP, static bearer check
│   │   ├── wooClient.ts          # REST client (consumer key/secret, timeouts, error mapping)
│   │   ├── tools/                # listProducts, createProduct, listOrders, getOrder, updateOrderStatus
│   │   └── project.ts            # field projection + list caps with truncation marker
│   └── Dockerfile
│
└── extra-mcp/
    ├── utils-mcp/                # e.g. get_time, calculator (AST-based, no eval)
    └── notes-mcp/                # e.g. save_note, list_notes, get_note
```

---

## 3. Database schema

Full migration: `apps/gateway/migrations/001_init.sql` (also delivered as a separate file).

```sql
-- 001_init.sql — MCP Gateway schema (PostgreSQL 14+)
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email

-- ───────────── Users & auth ─────────────
CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          citext NOT NULL UNIQUE,
  name           text   NOT NULL,
  password_hash  text   NOT NULL,                       -- argon2id / bcrypt
  role           text   NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  disabled       boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        citext NOT NULL,
  role         text   NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  token_hash   text   NOT NULL UNIQUE,                  -- SHA-256 of invite token
  invited_by   uuid   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at   timestamptz NOT NULL,
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invitations_email_idx ON invitations (email);

CREATE TABLE sessions (
  id          text PRIMARY KEY,                         -- random 256-bit, stored hashed or opaque
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx    ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  key_prefix    text NOT NULL,                          -- e.g. kgw_ab12cd (display only)
  key_hash      text NOT NULL UNIQUE,                   -- SHA-256 of full key; plaintext never stored
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);
CREATE INDEX api_keys_user_idx ON api_keys (user_id);

-- ───────────── Upstream MCP servers ─────────────
CREATE TABLE upstream_servers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE
                     CHECK (slug ~ '^[a-z][a-z0-9-]{0,31}$'),   -- no "__" possible
  name             text NOT NULL,
  url              text NOT NULL,
  enabled          boolean NOT NULL DEFAULT true,
  auth_type        text NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none','bearer','header')),
  auth_header_name text,
  credential_enc   bytea,                               -- AES-GCM (iv||tag||ciphertext), write-only via API
  status           text NOT NULL DEFAULT 'unreachable'
                     CHECK (status IN ('connected','unreachable','disabled')),
  last_error       text,
  last_checked_at  timestamptz,
  tools_digest     text,                                -- hash of tool declarations (poisoning detection)
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (auth_type <> 'header' OR auth_header_name IS NOT NULL),
  CHECK (auth_type = 'none' OR credential_enc IS NOT NULL)
);

-- ───────────── Audit ─────────────
CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  ts            timestamptz NOT NULL DEFAULT now(),
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  api_key_id    uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  via           text NOT NULL CHECK (via IN ('mcp','chat','dashboard')),
  server_slug   text,
  tool_name     text,
  args_hash     text,                                   -- hash only, never raw args
  duration_ms   integer,
  outcome       text NOT NULL CHECK (outcome IN ('success','error','denied','timeout')),
  error_code    text,
  error_message text
);
CREATE INDEX audit_ts_idx     ON audit_log (ts DESC);
CREATE INDEX audit_user_idx   ON audit_log (user_id, ts DESC);
CREATE INDEX audit_server_idx ON audit_log (server_slug, ts DESC);
CREATE INDEX audit_outcome_idx ON audit_log (outcome, ts DESC);

-- ───────────── Chat ─────────────
CREATE TABLE conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'New chat',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_user_idx ON conversations (user_id, created_at DESC);

CREATE TABLE messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('user','assistant','tool')),
  content          text,
  tool_calls       jsonb,                               -- [{id,name,args,result,outcome}]
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conv_idx ON messages (conversation_id, created_at);

-- ───────────── Bonus: tool permissions ─────────────
CREATE TABLE tool_policies (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role         text NOT NULL CHECK (role IN ('admin','member')),
  server_slug  text NOT NULL,                           -- '*' = all servers
  tool_pattern text NOT NULL DEFAULT '*',               -- glob, e.g. woo__get_*
  effect       text NOT NULL CHECK (effect IN ('allow','deny')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, server_slug, tool_pattern)
);
-- Evaluation: deny beats allow; no matching rule => deny (member), allow (admin).

COMMIT;
```

Notes:
- `api_keys.key_hash` is SHA-256 of a high-entropy key; plaintext is shown once at creation and never stored.
- `upstream_servers.credential_enc` is AES-GCM ciphertext; the key comes from a Kubernetes Secret.
- `audit_log.args_hash` is a hash of the arguments, not the raw arguments (they may contain PII).

---

## 4. API reference

### Auth and session
| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | public | email + password, sets session cookie |
| POST | `/api/auth/logout` | session | clears session |
| GET | `/api/auth/me` | session | current user and role |
| POST | `/api/auth/accept-invite` | public | `{token, name, password}` completes an invite |

### Members (admin)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/members` | list users |
| POST | `/api/members/invite` | `{email, role}`, returns invite link/token |
| PATCH | `/api/members/:id` | change role or disable |
| DELETE | `/api/members/:id` | remove user and revoke their keys |

### API keys
| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/keys` | session | own keys (admin: all or `?userId=`). Never returns hash or plaintext |
| POST | `/api/keys` | session | `{name}`; **returns the plaintext key once** |
| DELETE | `/api/keys/:id` | owner or admin | revoke |

### Upstream servers
| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/servers` | session | list with status and tool count; credentials never included |
| POST | `/api/servers` | admin | `{slug, name, url, authType, credential?, enabled}`; SSRF check + test connect |
| POST | `/api/servers/test` | admin | try a URL and credential without saving |
| GET | `/api/servers/:id` | session | detail with last error |
| PATCH | `/api/servers/:id` | admin | edit; omit `credential` to keep the existing one |
| POST | `/api/servers/:id/enable` | admin | enable |
| POST | `/api/servers/:id/disable` | admin | disable (tools vanish for chat and MCP clients) |
| POST | `/api/servers/:id/refresh` | admin | re-check health and re-list tools now |
| GET | `/api/servers/:id/tools` | session | tools this server exposes |
| DELETE | `/api/servers/:id` | admin | remove |

### Tools and audit
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/tools` | aggregated tool list for the current principal (same function as MCP `tools/list`) |
| GET | `/api/audit` | filters: `userId, server, tool, outcome, from, to, limit, cursor`. Admin sees all; member sees own |

### Chat
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/chat/conversations` | list own conversations |
| POST | `/api/chat/conversations` | create |
| GET | `/api/chat/conversations/:id/messages` | history |
| POST | `/api/chat/conversations/:id/messages` | `{message}`; responds as **SSE** |

SSE event types: `token`, `tool_call {name,args}`, `tool_result {name,ok,durationMs,summary}`, `error`, `done`.

### MCP endpoint (external clients)
| Method | Path | Notes |
|---|---|---|
| POST | `/mcp` | `Authorization: Bearer kgw_...`. Handles `initialize`, `ping`, `tools/list`, `tools/call`. Stateless: no session ID |
| GET, DELETE | `/mcp` | 405 (no server push, no sessions) |

### Ops
| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | liveness |
| GET | `/readyz` | readiness (DB reachable, migrations applied) |
| GET | `/metrics` | optional, for the observability bonus |

### Conventions
- Single error shape: `{ "error": { "code": "UPSTREAM_TIMEOUT", "message": "..." } }`.
- Credentials are write-only. The API accepts them and never returns them; the UI sees only `hasCredential: true`.
- Failures to the model and to MCP clients are returned as `isError: true` results so the caller can read them.

---

## 5. The single call path

```ts
executeTool(principal, namespacedName, args, { via: 'mcp' | 'chat' })
  // 1. decode "woo__list_orders" -> { slug: 'woo', tool: 'list_orders' }
  // 2. server exists? enabled? breaker closed?
  // 3. policy.check(principal, slug, tool)  -> deny = audit + isError
  // 4. call upstream with stored credential, AbortSignal timeout (e.g. 15s)
  // 5. finally: audit row (user, server, tool, args_hash, duration, outcome)
```

`/mcp` and `chat/agent.ts` call only this function.

### One request, end to end
1. Client sends `tools/call` with `Authorization: Bearer kgw_...`.
2. Gateway hashes the key, looks it up, rejects if missing or revoked, builds the `Principal`.
3. Executor decodes `woo__list_orders`, finds the upstream, checks enabled and breaker state.
4. Policy check (default deny).
5. Gateway calls the upstream with its **own** stored credential, under a timeout. The client's key is never forwarded.
6. Woo MCP server calls the WooCommerce REST API and returns a projected, size-capped result.
7. Audit row written in `finally`; result returned.

---

## 6. Aggregation and naming

- `tools/list` fans out to all enabled upstreams **in parallel**, each with its own timeout, using `allSettled` semantics. A dead server contributes nothing and is marked `unreachable`; it never blocks the others.
- Names are always `slug__tool` (not only on collision), so tool names stay stable when a second server is added. Slugs must be unique, lowercase, and must not contain `__`.
- Calls split on the first `__` and route to the matching upstream.
- Each upstream's tool declarations are hashed (name + description + schema). A changed digest raises an alert (defence against tool poisoning).
- Risk/permission is assigned **locally**, never trusted from a remote server's declaration.

---

## 7. Failure behaviour

| Scenario | Behaviour |
|---|---|
| Revoke a member's key | Hash lookup sees `revoked_at`; next call returns 401 |
| Disable an upstream | Filtered from list and rejected on call, for chat and MCP clients alike |
| Kill an upstream pod | Calls time out, breaker opens, status becomes `unreachable`; other upstreams unaffected |
| Slow upstream | Per-upstream timeout returns a clear error; other servers' listing unaffected |
| Malicious upstream | Digest-change alert; results treated as data; local risk assignment; policy still applies |
| Gateway restart | State lives in Postgres; upstream clients are rebuilt by the manager on boot |

---

## 8. Security design

| Concern | Control |
|---|---|
| API keys | Random, shown once, stored as SHA-256 hash, revocable |
| Upstream credentials | AES-GCM encrypted at rest, decrypted only inside the executor, never returned by any API |
| Token passthrough | Client keys are never forwarded; the gateway uses its own stored credential per upstream |
| Identity | `Principal` comes from the session or key, never from a tool argument |
| SSRF | Validate scheme, hostname, and every resolved IP when an admin adds a URL; block loopback, link-local (169.254.0.0/16), RFC 1918, metadata hostnames. In-cluster upstreams are allowed through an explicit allowlist of namespaces/hosts |
| Prompt injection | Tool results returned to the LLM are wrapped and labelled as untrusted data; the policy layer, not the prompt, is the control |
| Audit | Every call and every denial is logged; args hashed |
| Containers | Non-root, read-only root filesystem where possible, resource requests and limits |
| Origin | Validate `Origin` on `/mcp` |

### Secrets (all from Kubernetes Secrets)
`DATABASE_URL`, `SESSION_SECRET`, `CREDENTIAL_ENC_KEY` (32 bytes), `LLM_API_KEY`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, and the Woo MCP bearer token used to seed the first upstream.

---

## 9. Chat agent

- Runs in-process in the gateway; gets its tool list from the same aggregator function as `/mcp` and calls tools only through `executeTool` with the logged-in user's `Principal`.
- Loop controls: max iterations, max total tool calls, identical-call detection, and a consecutive-failure cap. When a control fires, one guidance message is injected and the model is asked to answer with what it has.
- Parallel independent calls are allowed in one turn.
- Streams `tool_call` and `tool_result` events over SSE so the UI shows which tools ran.

---

## 10. WooCommerce MCP server

- Talks to the store through the **WooCommerce REST API** (consumer key/secret from a Secret). Rationale for the docs: REST is versioned, authenticated, and needs no exec access into the WordPress pod, unlike WP-CLI.
- Tools: `list_products`, `create_product`, `list_orders`, `get_order`, `update_order_status`.
- Responses are projected to useful fields; lists are capped with an explicit truncation marker; `status` is an enum so bad values fail validation with a repairable message.
- Exposed as a ClusterIP Service only, with a NetworkPolicy allowing ingress from the gateway pods, plus a static bearer secret the gateway must present.

## 11. Extra upstream servers

Two small Streamable HTTP servers you own (e.g. `utils-mcp`: time + AST-based calculator; `notes-mcp`: save/list/get notes). Easy to kill in the dead-upstream demo, and they avoid adapting stdio-only reference servers.

---

## 12. Testing priorities

1. `executeTool`: denied, disabled, timeout, breaker-open, success; assert an audit row for each.
2. Aggregator: one dead upstream does not break listing; name collision handling.
3. API key lifecycle: create, use, revoke, reject.
4. SSRF validator: loopback, link-local, private ranges, DNS to private IP.
5. Chat loop: repeated-call detection stops the loop.
6. Credentials never appear in any API response or log line.

---

## 13. Bonus hooks already designed in

| Bonus | Where it plugs in |
|---|---|
| Tool permissions | `policy/rules.ts` + `tool_policies` table; filter in `listTools` and enforce in `executeTool` |
| Security hardening | `security/*`, non-root images, default-deny NetworkPolicies |
| Scaling | Stateless `/mcp`; run multiple replicas; `rateLimit.ts` per key |
| Observability | `/metrics` from audit data, per-server latency and error counts |
| Multi-store provisioning | Add a `provisioner/` module using the Kubernetes API; registers each new store's woo-mcp through the same `upstream/manager.ts` |
