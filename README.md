# WooCommerce MCP Gateway on Kubernetes (Urumi Round 1)

WooCommerce hosting with a team MCP gateway. An admin registers MCP servers once in the dashboard. Every team member then reaches all of them through **one MCP endpoint** with their own API key, and through a chat agent in the dashboard. Everything runs in Kubernetes from **one Helm chart**; local (Kind) and VPS (k3s) differ only in values files.

```
 MCP client (Bearer kgw_…)          Browser
        |                              |
        +----------- Ingress ----------+-------------------+
          app.<domain>  /mcp /api      | /                 | store.<domain>
                  v                    v                   v
              Gateway  <---------- Dashboard          WordPress + WooCommerce
     (auth, aggregation, policy,   (Next.js)                 |   (PVC)
      rate limit, timeout,                                MariaDB (PVC)
      breaker, audit, chat agent)                            ^
                  |  stored upstream credentials             | REST /wp-json/wc/v3
     +------------+------------+---------------+             |
     v            v            v               v             |
  woo-mcp     utils-mcp    notes-mcp     woo-mcp (store-x) --+
  ClusterIP only; NetworkPolicy admits only the gateway
```

| Layer | Code | Notes |
|---|---|---|
| Store | `charts/platform/templates/{wordpress,mariadb}.yaml`, `charts/platform/files/init-store.sh` | WordPress + WooCommerce 9.9.5 + MariaDB on PVCs; a Helm hook Job installs Woo, enables COD and creates the REST key |
| WooCommerce MCP server | `woo-mcp/`, shared transport in `mcp-servers/shared/` | Hand-written, Streamable HTTP; `list_products`, `create_product`, `list_orders` (status + date range), `get_order`, `update_order_status` |
| Gateway + dashboard | `server/` (Express, Prisma/Postgres), `client/` (Next.js) | MCP client to every upstream and MCP server at `/mcp` |
| Chat agent | `server/src/chat/` | OpenAI-compatible tool loop that calls tools through the gateway as the logged-in user |
| Extra upstreams | `utils-mcp/` (time, calculator, currency), `notes-mcp/` (notes) | Needed for the "three upstreams" and cross-server requirements |

More detail: [docs/system-design.md](docs/system-design.md) and [docs/threat-model.md](docs/threat-model.md).

---

## 1. Local setup (Kind)

### Prerequisites

- Docker, [kind](https://kind.sigs.k8s.io/) and kubectl. Helm 3 is optional; the script copies `helm` out of the gateway image if you don't have it.
- **Host port 80 free.** Kind maps ingress to :80, so stop any local web server first (`sudo systemctl stop nginx`).
- **inotify limits.** Kind's kube-proxy crash-loops with `too many open files` on the Ubuntu defaults:
  ```bash
  sudo sysctl fs.inotify.max_user_watches=524288 fs.inotify.max_user_instances=512
  ```
- **An LLM for chat.** By default the script points chat at **Ollama on the host** (`gpt-oss:120b-cloud`). Ollama binds `127.0.0.1:11434`, so the script starts an `alpine/socat` container on `:11435` that pods can reach. To use a hosted provider instead, export these before the first run:
  ```bash
  export LLM_BASE_URL=https://openrouter.ai/api/v1 LLM_MODEL=openai/gpt-4o-mini LLM_API_KEY=sk-or-...
  ```
  The key goes into the generated secrets file, never into values.

### Bring it up

```bash
./scripts/kind-up.sh          # SKIP_BUILD=1 to reuse already-built images
```

The script does the following:

1. Creates the cluster from `clusters.yml`.
2. Installs ingress-nginx.
3. Builds the five images and loads them into Kind.
4. Generates `charts/platform/secrets.local.yaml`, with random passwords, keys and the WooCommerce REST key.
5. Runs:
   ```bash
   helm upgrade --install platform ./charts/platform -n platform \
     -f values-local.yaml -f secrets.local.yaml
   ```

Wait for `kubectl -n platform get pods,jobs`: every pod should be Ready and `wp-init` should show `Complete`.

### Local domains

We use **[localtest.me](https://readme.localtest.me/)**: every `*.localtest.me` name resolves to `127.0.0.1` in public DNS. That means no `/etc/hosts` edits, and per-store hosts like `acme.localtest.me` work without extra setup.

| What | URL |
|---|---|
| Storefront | http://store.localtest.me |
| WP admin | http://store.localtest.me/wp-admin |
| Dashboard | http://app.localtest.me |
| MCP endpoint | http://app.localtest.me/mcp |

### Credentials

Everything is generated into `charts/platform/secrets.local.yaml` (gitignored) and stored in Kubernetes Secrets:

```bash
grep -E "bootstrapAdmin|wordpressAdmin" charts/platform/secrets.local.yaml
```

- **Dashboard admin:** `bootstrapAdminEmail` / `bootstrapAdminPassword`
- **WordPress admin:** `wordpressAdminUser` / `wordpressAdminPassword`

---

## 2. Place an order

1. Open http://store.localtest.me → **Shop** → add a product to the cart.
2. **Checkout**, fill in any billing details and choose **Cash on delivery**.
3. Place the order. You'll see "Order received" with the order number.
4. In WP admin, go to **WooCommerce → Orders**. The order is listed as *Processing*.

## 3. Use the chat agent

1. Log in to http://app.localtest.me and open **Chat**.
2. Try these prompts:
   - *"Create a product called Blue Mug priced 12.50"*. The product then appears on the storefront.
   - *"What orders came in today?"*
   - *"What orders came in today? Convert the total from USD to EUR and save a note called Daily summary."* This one uses woo, utils and notes.
3. Every tool call is shown as a card in the chat and appears in **Audit log** under your user, with `via = chat`.

The agent only sees the tools that user is allowed to use, and it calls them through the same `executeTool` path as external clients (`server/src/chat/agent.ts`).

## 4. Connect an external MCP client

1. Log in and go to **API keys** → **Create key**. The key (`kgw_…`) is shown once.
2. Add the gateway with only the URL and that key. The client never needs upstream credentials.

**Claude Code**

```bash
claude mcp add --transport http urumi-gateway http://app.localtest.me/mcp --header "Authorization: Bearer kgw_YOUR_KEY"
```

Then run `/mcp` inside `claude` to see the tools, and ask *"what orders came in today?"*.

**Cursor:** add this to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "urumi-gateway": {
      "url": "http://app.localtest.me/mcp",
      "headers": { "Authorization": "Bearer kgw_YOUR_KEY" }
    }
  }
}
```

**MCP Inspector**

```bash
npx @modelcontextprotocol/inspector
```

Then set **Transport** to *Streamable HTTP*, **URL** to `http://app.localtest.me/mcp`, and the header `Authorization: Bearer kgw_YOUR_KEY`.

**Raw JSON-RPC**

```bash
curl -s http://app.localtest.me/mcp -H 'Authorization: Bearer kgw_YOUR_KEY' -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**Tool names** are always `<server-slug>__<tool>`, for example `woo__list_orders`, `utils__convert_currency` and `woo-acme__list_orders`. Slugs can't contain `_`, so the split is unambiguous. Two servers exposing the same tool name never collide.

## 5. Team and control (definition-of-done walkthrough)

| Step | How | What you see |
|---|---|---|
| Invite user B | **Members → Invite** (role *member*), open the invite link, set a password | B can log in, but can't open Members, add servers or see other users' audit rows (API returns 403) |
| B gets a key | B → **API keys → Create** (or admin: **Team keys → Issue key**) | B connects Claude Code with only the URL and key |
| Revoke B's key | Admin: **API keys → Team keys → Revoke** (or B revokes their own) | B's next MCP call returns `Invalid or revoked API key` |
| Disable a server | **Servers → ⋯ → Disable** | Its tools disappear from `tools/list` and from chat immediately |
| Kill an upstream | `kubectl -n platform scale deploy/notes-mcp --replicas=0` (or delete the pod) | Within one health tick (15s) the dashboard shows **Unreachable** with the reason. Its tools drop out, calls to it fail fast with a clear error, and woo/utils keep working |
| Audit | **Audit log** | Every call: user, via (mcp/chat), server, tool, time, duration, outcome. Members see only their own rows |

## 6. Multi-store provisioning (bonus)

**Stores → New store** (for example name `Acme`, slug `acme`) runs `helm upgrade --install store-acme charts/store` into namespace `store-acme`. That namespace gets its own MariaDB, WordPress, PVCs, Secrets, Ingress host (`acme.localtest.me`), ResourceQuota, LimitRange, default-deny NetworkPolicies and its own woo-mcp. When the store is Ready, the gateway registers it as upstream `woo-acme`, so tools appear as `woo-acme__…`.

- **Compare stores:** ask the chat agent *"Compare today's orders across woo and woo-acme"*.
- **Delete:** Helm uninstall, namespace delete (which removes PVCs and Secrets), and upstream unregister. The tools disappear.
- **Guardrails:** at most 3 stores per user (`MAX_STORES_PER_USER`), a 600s provisioning timeout, and creates are safe to retry (same release and same encrypted secrets). State lives in Postgres, so a gateway restart mid-provisioning resumes or fails the store with a reason.

## 7. VPS / production (k3s)

The chart and templates are the same; only the values change. See `charts/platform/values-prod.yaml`.

```bash
# 1. VPS with k3s, keeping Traefik out of the way so ingress-nginx owns :80/:443
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik" sh -
helm upgrade --install ingress-nginx ingress-nginx --repo https://kubernetes.github.io/ingress-nginx -n ingress-nginx --create-namespace
helm upgrade --install cert-manager cert-manager --repo https://charts.jetstack.io -n cert-manager --create-namespace --set crds.enabled=true
# then create a ClusterIssuer named letsencrypt-prod (HTTP-01 via nginx)

# 2. DNS: A records for app.<domain> and store.<domain> (+ *.stores.<domain> for extra stores) -> VPS IP

# 3. Images: push to a registry and set images.* in values-prod.yaml
IMAGE_TAG=1.0.0 ./scripts/build-images.sh   # then docker tag/push to ghcr.io/<you>/...

# 4. Secrets: generated once, kept off git
LLM_API_KEY=sk-or-... ./scripts/gen-secrets.sh > secrets.prod.yaml

# 5. Install
helm upgrade --install platform ./charts/platform -n platform --create-namespace \
  -f charts/platform/values-prod.yaml -f secrets.prod.yaml \
  --set llm.baseUrl=https://openrouter.ai/api/v1 --set llm.model=openai/gpt-4o-mini
```

| Concern | `values-local.yaml` (Kind) | `values-prod.yaml` (k3s) |
|---|---|---|
| Domains | `*.localtest.me` → 127.0.0.1 | real DNS (`app.`, `store.`, `*.stores.`) |
| Ingress / TLS | ingress-nginx, HTTP | ingress-nginx + cert-manager (`ingress.tls`, `clusterIssuer`) |
| Storage | Kind `standard` | k3s `local-path` (or a cloud storage class) |
| Images | `*:local`, loaded with `kind load` | registry + pinned tags |
| Secrets | `secrets.local.yaml` (generated) | `secrets.prod.yaml` (generated; or Sealed Secrets / External Secrets) |
| LLM | host Ollama via socat | hosted OpenAI-compatible API (egress 443 only) |
| Resources | small requests | larger WordPress/gateway requests |

## 8. Upgrade and rollback

```bash
# upgrade: new image tags or config
helm upgrade platform ./charts/platform -n platform -f charts/platform/values-local.yaml -f charts/platform/secrets.local.yaml --set images.gateway.tag=1.0.1
helm history platform -n platform
helm rollback platform <REVISION> -n platform
```

- **Gateway, dashboard and MCP servers** are stateless Deployments, so rollback is just the previous ReplicaSet. The gateway schema is applied with `prisma db push` at boot, so keep schema changes additive so an older image still runs.
- **WordPress/MariaDB** live on PVCs. Rollback restores the Deployment spec, not the data. Take a DB dump before a WooCommerce version bump (`kubectl exec deploy/mariadb -- mariadb-dump …`). The `wp-init` hook is idempotent and re-runs on every upgrade.
- **Per-store releases** upgrade the same way: `helm upgrade store-<slug> charts/store -n store-<slug> --reuse-values`.

## 9. Bonus and stand-out items implemented

| Item | Where |
|---|---|
| **Multi-store provisioning** (create/delete from dashboard, own namespace/DB/PVC/Secrets/Ingress, auto MCP registration, teardown, quota/limits, per-user cap, timeout, retry/recovery) | `server/src/provisioner/`, `server/src/routes/stores.ts`, `charts/store/`, `client/app/(app)/stores/` |
| **Security hardening:** least-privilege provisioner RBAC + ValidatingAdmissionPolicy | `charts/platform/templates/rbac.yaml` |
| Default-deny NetworkPolicies (platform and every store namespace) | `charts/platform/templates/networkpolicy.yaml`, `charts/store/templates/networkpolicy.yaml` |
| Upstream credentials encrypted at rest (AES-256-GCM), write-only in the API | `server/src/security/crypto.ts`, `server/src/routes/servers.ts` |
| SSRF checks on admin-added URLs (private ranges, metadata endpoints) | `server/src/security/ssrf.ts` |
| Non-root MCP, gateway and dashboard containers | `*/Dockerfile` |
| Refuses to start in production with default secrets | `server/src/config.ts` |
| **Rate limits** per user (tool calls, shared by MCP and chat) and on login | `server/src/security/rateLimit.ts` |
| **Observability:** tool calls per day, error rate and p50/p95 latency per server; unreachable reason shown per upstream | `server/src/routes/audit.ts` (`/stats`), `client/components/overview/tool-calls-chart.tsx`, `server/src/upstream/health.ts` |
| Circuit breaker per upstream | `server/src/upstream/breaker.ts` |
| Tool-declaration digest (detects upstreams changing their tool definitions) | `server/src/upstream/digest.ts` |
| Tool permission engine (per role × server × tool pattern, deny beats allow; denied tools are hidden from the list and rejected on call). Rules live in the `tool_policies` table; there is no UI to edit them yet | `server/src/policy/engine.ts` |
| Upgrade/rollback story | section 8 above |

## 10. Docker Compose (dev only)

`docker compose up --build` runs the same components without Kubernetes, using fixed dev credentials from `docker-compose.yml`:

- Storefront: http://localhost:8080
- Dashboard: http://localhost:3000
- MCP: http://localhost:4000/mcp

The gateway runs with `NODE_ENV=development` here; in production it refuses those defaults.

## Repository layout

```
charts/platform   Helm chart: store, DB, gateway, dashboard, MCP servers, ingress, netpols, RBAC
charts/store      Per-store chart used by the provisioner (bonus)
server/           Gateway backend, MCP endpoint, chat agent, provisioner (Bun + Express + Prisma)
client/           Dashboard (Next.js)
woo-mcp/          WooCommerce MCP server (REST API client)
utils-mcp/ notes-mcp/   Extra upstream MCP servers
mcp-servers/shared      Shared Streamable HTTP server wrapper
scripts/          kind-up.sh, build-images.sh, gen-secrets.sh
docs/             System design, threat model
```
