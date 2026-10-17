# System design and tradeoffs

## Components

| Component | Runs as | Responsibility |
|---|---|---|
| **Gateway** (`server/`) | Deployment `gateway`, ServiceAccount `gateway` | Dashboard REST API (sessions), MCP server at `/mcp` (API keys), MCP client to every upstream, chat agent, audit, store provisioner |
| **Dashboard** (`client/`) | Deployment `dashboard` | Next.js UI. Ingress sends `/api` and `/mcp` straight to the gateway and `/` to the dashboard |
| **woo-mcp** | Deployment, ClusterIP | Hand-written MCP server (Streamable HTTP, stateless) → WooCommerce REST API |
| **utils-mcp / notes-mcp** | Deployments, ClusterIP | Second and third upstreams (calculator/time/currency, notes) for cross-server prompts |
| **WordPress + WooCommerce** | Deployment + PVC (`/var/www/html`) | The store. A Helm hook Job (`wp-init`, WP-CLI) installs Woo, enables COD and creates the REST key, idempotently |
| **MariaDB** | Deployment + PVC | Store database |
| **PostgreSQL** | Deployment + PVC | Users, hashed API keys, upstream registry (encrypted credentials), audit log, chat history, stores |

Everything is in namespace `platform`, plus one `store-<slug>` namespace per provisioned store.

## How a tool call travels

```
Claude Code ──POST /mcp {tools/call "woo__list_orders"}  Authorization: Bearer kgw_…
   │
ingress-nginx (app.<domain>/mcp) ──► gateway
   1. verify key: sha256(kgw_…) lookup, not revoked, user not disabled  → Principal{userId, role}
   2. decode "woo__list_orders" → server "woo", tool "list_orders"
   3. per-user rate limit · server registered & enabled · circuit breaker closed · policy allows
   4. upstream client for "woo" (already connected; stored bearer token decrypted in memory)
      ──POST http://woo-mcp:4011/mcp  Authorization: Bearer <upstream token>  (timeout 15s)
   5. woo-mcp ──GET http://wordpress/wp-json/wc/v3/orders?after=…  (consumer key/secret, Host: store.<domain>)
   6. result back up the chain; audit row {user, via, server, tool, ts, duration, outcome}
```

The chat agent runs the same steps 2–6 in-process with the session's Principal and `via=chat`. There is no other route to an upstream: NetworkPolicies admit only `app=gateway` pods to the MCP servers.

## Tool aggregation and routing

- **Naming / collisions:** every tool is exposed as `<slug>__<tool>`, always, not only on collision. Slugs match `^[a-z][a-z0-9-]*$`, so the first `__` splits unambiguously. Two servers that both expose `list_orders` show up as `woo__list_orders` and `woo-acme__list_orders`. Names stay stable when a server is added or removed, which matters for clients that cache tool lists. The cost is longer names, which is fine for models.
- **Listing:** `tools/list` fans out to all enabled, connected upstreams in parallel (`Promise.allSettled`). Each gets a 5s cap, and upstreams with an open breaker are skipped. A slow upstream costs at most 5s and never fails the whole list. Denied tools (policy) are filtered out.
- **Calling:** routed by slug to the one upstream client. 15s timeout, with the SDK request aborted too. Errors come back as MCP `isError` results with a readable message (`Error calling "notes__list_notes": Unable to connect…`), so clients and the model see why.

## Failure handling

| Situation | Behaviour |
|---|---|
| Upstream pod dies | Health loop (every 15s, all servers in parallel, 5s connect/list timeouts) marks it **unreachable** with the reason and drops the stale session. Its tools vanish from listings; calls fail fast; other upstreams unaffected. |
| It comes back | Next health tick reconnects and marks it **connected**; calls also reconnect lazily. |
| Flapping / slow upstream | Circuit breaker opens after 3 consecutive failures for 30s, then half-opens. |
| Admin disables a server | Client disconnected and removed at once; status `disabled`; tools hidden from MCP and chat. |
| MCP server pod terminating | SIGTERM handler closes idle keep-alive sockets and exits, so the gateway doesn't keep talking to a dying pod. |
| Gateway boot with an upstream down | Upstreams connect in parallel with timeouts, so boot isn't blocked. |

## Key design choices and tradeoffs

- **WooCommerce REST API vs WP-CLI.** woo-mcp uses `/wp-json/wc/v3` with a consumer key/secret. REST is versioned, returns JSON, runs over a Service with no pod exec, and lets woo-mcp run in its own pod with a NetworkPolicy to WordPress only. WP-CLI would need exec rights into the WordPress pod, which is a much bigger privilege. WP-CLI is still the right tool for one-shot setup, so it's used only in the `wp-init` hook. WooCommerce only accepts key auth over HTTPS, so a small mu-plugin marks in-cluster `/wp-json/wc/*` requests as HTTPS. The wire is cluster-internal and restricted by NetworkPolicy.
- **Gateway's MCP endpoint is a small hand-rolled JSON-RPC handler** (`initialize`, `ping`, `tools/list`, `tools/call`, notifications → 202) instead of the SDK server transport. It's stateless (no `Mcp-Session-Id`), so any replica can serve any request, and auth happens before any MCP processing. The tradeoff is no server→client streaming. We don't need it, because aggregated tools are request/response.
- **Upstream clients are long-lived and stateful in the gateway process.** This means one connection per upstream rather than per request, and health and breaker state live with them. The tradeoff is that state is per replica (see scaling).
- **Provisioner = gateway shells out to `helm`** with a DB-backed state machine (`provisioning → ready | failed`, `deleting`). That's simpler than writing an operator and reuses the same chart a human would run. State in Postgres makes it restart-safe and retryable. Tradeoffs: a ~1GB gateway image, and an in-process worker that should run as a single instance.
- **Chat agent** uses any OpenAI-compatible endpoint (Ollama locally, OpenRouter in prod) with a capped loop: 10 iterations and 20 tool calls, with repeat detection.

## Scaling notes

The chart runs one gateway replica. Before running more, the following would have to move:

- **Upstream registry changes**, which today are applied to the local process. They'd need to be broadcast (Postgres `LISTEN/NOTIFY`), or each replica would reload from the DB on the health tick.
- **Rate-limit counters and breakers.** They're in memory, so they'd move to Redis or Postgres.
- **The provisioner worker.** Exactly one worker should run, so it needs leader election (a Lease) or a separate Deployment with `replicas: 1`.

The `/mcp` endpoint itself is already stateless and replica-safe.

## What changes for production

The chart is the same; only `values-prod.yaml` and `secrets.prod.yaml` change.

| Concern | Local (Kind) | Production (k3s VPS) |
|---|---|---|
| **DNS** | `*.localtest.me` resolves to 127.0.0.1 publicly, so no hosts file | A records for `app.` and `store.`, plus wildcard `*.stores.` for provisioned stores |
| **Ingress** | ingress-nginx (Kind manifest), HTTP | ingress-nginx (k3s installed with `--disable traefik`), TLS from cert-manager (`ingress.tls: true`, `clusterIssuer`) |
| **Storage class** | `standard` (Kind local-path) | `local-path` (k3s) or a cloud block-storage class; back up the MariaDB and Postgres PVCs |
| **Secrets** | `scripts/gen-secrets.sh` → `secrets.local.yaml` (gitignored) → K8s Secrets | Same generator → `secrets.prod.yaml` kept off git, or Sealed Secrets / External Secrets. The gateway refuses to start in production with default values |
| **Images** | built locally, `kind load` | pushed to a registry, pinned tags in values |
| **LLM** | host Ollama through a socat bridge (egress port 11435) | hosted API over 443 |
| **Cookies / CORS** | HTTP | `COOKIE_SECURE`, real origin |
