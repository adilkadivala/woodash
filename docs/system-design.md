# System design and tradeoffs

## Components

| Component | Role |
|-----------|------|
| **Gateway (`server/`)** | REST dashboard API, session + API-key auth, MCP aggregation, chat agent, audit |
| **Dashboard (`client/`)** | Next.js UI; proxies `/api/*` to gateway |
| **woo-mcp** | Streamable HTTP MCP → WooCommerce REST (or mock store locally) |
| **utils-mcp / notes-mcp** | Extra upstreams for multi-server demos |
| **PostgreSQL** | Users, keys (hashed), upstream registry, encrypted credentials, audit, chat history |

## Tool aggregation and routing

- Every upstream tool is exposed as `slug__tool_name` (stable even without collisions).
- `listAllTools` fans out in parallel with per-upstream timeouts; failures are isolated.
- `executeTool` is the only execution path for MCP and chat (policy, breaker, timeout, audit).

## Failure handling

- Dead upstream: health loop marks `unreachable`; listing skips it; calls return clear errors; circuit breaker opens after repeated failures.
- Disabled upstream: removed from manager; status `disabled`; tools hidden.

## Production vs local

| Concern | Local | Production (K8s) |
|---------|-------|------------------|
| Upstream URLs | `127.0.0.1` / Docker service names | Cluster DNS (`*.svc.cluster.local`) |
| Secrets | `.env` / compose | Kubernetes Secrets |
| Ingress | localhost + Next rewrites | Single host: `/` dashboard, `/api` + `/mcp` gateway |
| Woo store | Mock or dev store URL | In-cluster WordPress + Woo + REST keys |
| SSRF | `SSRF_ALLOW_LOCALHOST=true` in dev | Strict URL validation for admin-added servers |

## Prisma

Gateway uses Prisma 7 with the `@prisma/adapter-pg` driver adapter and `prisma db push` / migrations for schema sync.
