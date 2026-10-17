# System design and tradeoffs

## Components

| Component | Role |
|-----------|------|
| **Gateway (`server/`)** | REST dashboard API, session + API-key auth, MCP aggregation, chat agent, audit |
| **Dashboard (`client/`)** | Next.js UI; proxies `/api/*` to gateway |
| **woo-mcp** | Streamable HTTP MCP → WooCommerce REST (`WOO_USE_MOCK=false` in cluster/compose) |
| **utils-mcp / notes-mcp** | Extra upstreams for multi-server demos |
| **PostgreSQL** | Users, keys (hashed), upstream registry, encrypted credentials, audit, chat history, stores |
| **Store chart (`charts/store`)** | Per-tenant namespace: MariaDB, WordPress/Woo, Woo MCP, Ingress, quota, NetworkPolicies |

## Tool aggregation and routing

- Every upstream tool is exposed as `slug__tool_name` (stable even without collisions).
- `listAllTools` fans out in parallel with per-upstream timeouts; failures are isolated.
- `executeTool` is the only execution path for MCP and chat (policy, breaker, timeout, audit).

## Failure handling

- Dead upstream: health loop marks `unreachable`; listing skips it; calls return clear errors; circuit breaker opens after repeated failures.
- Disabled upstream: removed from manager; status `disabled`; tools hidden.

## Production vs local

Same Helm chart: `charts/platform` with `values-local.yaml` vs `values-prod.yaml`.

| Concern | Local (Kind) | Production (k3s) |
|---------|--------------|------------------|
| Domains | `store.localtest.me` / `app.localtest.me` → 127.0.0.1 | Real DNS A records |
| Ingress | ingress-nginx, no TLS | nginx + cert-manager TLS |
| Storage | Kind `standard` | k3s `local-path` (or cloud class) |
| Secrets | `secrets.local.yaml` → K8s Secrets | `secrets.prod.yaml` / sealed secrets |
| Woo MCP | ClusterIP; REST to `http://wordpress` + `Host: store…` | same pattern, https public host |
| Images | `kind load` `*:local` | registry + tag in values-prod |

## Multi-store provisioning

The gateway worker watches `stores` rows in `provisioning` / `deleting`. Create from `POST /api/stores` (dashboard **Stores**):

1. Persist the row and generate Woo REST + MCP + DB secrets (AES-GCM in `stores.secrets_enc`).
2. `helm upgrade --install store-{slug} charts/store -n store-{slug} --create-namespace --wait`.
3. Register upstream `woo-{slug}` at `http://woo-mcp.store-{slug}.svc.cluster.local:4011/mcp`.
4. Timeouts mark **Failed**; retry is the same Helm release (idempotent). Delete uninstalls Helm and the namespace.

Several stores provision in parallel. Isolation is NetworkPolicy plus separate PVCs/DBs per namespace.

## Prisma

Gateway uses Prisma 7 with the `@prisma/adapter-pg` driver adapter and `prisma db push` / migrations for schema sync.
