# WooCommerce MCP Gateway (Urumi Round 1)

Team MCP gateway with a React dashboard, Prisma/PostgreSQL backend, and three upstream MCP servers (WooCommerce, utils, notes). External clients and the in-dashboard chat agent call tools through a single `/mcp` endpoint.

## Architecture (local)

```
Dashboard (Next.js :3000)  ──rewrite──►  Gateway (:4000)
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
              woo-mcp (:4011)           utils-mcp (:4002)         notes-mcp (:4003)
                    │
            WooCommerce REST (or mock store for dev)
```

Deep dives: [backend-architecture.md](./backend-architecture.md), [frontend-architecture.md](./frontend-architecture.md), [docs/system-design.md](./docs/system-design.md), [docs/threat-model.md](./docs/threat-model.md).

## Prerequisites

- [Bun](https://bun.sh) 1.2+
- Docker (PostgreSQL)
- Optional: `LLM_API_KEY` for the chat agent (OpenAI-compatible API)

## Quick start (local)

### 1. Database

```bash
docker compose up -d postgres
```

### 2. Gateway

```bash
cp server/.env.example server/.env   # edit DATABASE_URL / secrets if needed
cd server
bun install
bunx prisma db push
bun run dev
```

Bootstrap admin (first boot):

- Email: `admin@gateway.local`
- Password: `admin12345678`

### 3. Upstream MCP servers

In separate terminals:

```bash
cd woo-mcp && bun install && bun run src/index.ts    # http://127.0.0.1:4011/mcp
cd utils-mcp && bun install && bun run src/index.ts  # :4002
cd notes-mcp && bun install && bun run src/index.ts    # :4003
```

> **Note:** Default Woo MCP port is **4011** to avoid clashing with other services on 4001.

After changing upstream URLs, use **Servers → Refresh** in the dashboard or `POST /api/servers/:id/refresh`.

### 4. Dashboard

```bash
cd client
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), log in, and use Servers, Tools, Keys, Chat, and Audit.

### All-in-one Docker (optional)

```bash
export LLM_API_KEY=sk-...   # optional
docker compose up --build
```

Dashboard: [http://localhost:3000](http://localhost:3000) · Gateway API: [http://localhost:4000](http://localhost:4000)

## Connect an external MCP client

1. Create an API key in **API keys** (shown once).
2. Point your client at `https://<your-host>/mcp` with header `Authorization: Bearer kgw_...`.

Example:

```bash
curl -s http://localhost:4000/mcp \
  -H 'Authorization: Bearer kgw_YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Tool names are namespaced: `woo__list_orders`, `utils__current_time`, `notes__save_note`.

## Chat agent

Set `LLM_API_KEY` (and optionally `LLM_MODEL`, `LLM_BASE_URL`) in `server/.env`. Chat streams SSE from `POST /api/chat/conversations/:id/messages` and executes tools as the logged-in user (audit `via=chat`).

## WooCommerce MCP

- **Production / K8s:** set `WOO_STORE_URL`, `WOO_CONSUMER_KEY`, `WOO_CONSUMER_SECRET`, `WOO_USE_MOCK=false`.
- **Local demo:** `WOO_USE_MOCK=true` (default) uses an in-memory catalog and orders.

Tools: `list_products`, `create_product`, `list_orders`, `get_order`, `update_order_status`.

## Kubernetes / Helm

Helm charts and Kind cluster config are the next step for the full assignment deliverable. Use `clusters.yml` for a sample Kind cluster and extend with charts under `charts/` (store, gateway, dashboard, MCP servers). Production differences (ingress host, storage class, secrets) belong in `values-prod.yaml` vs `values-local.yaml`.

## Scripts

| Path | Command | Purpose |
|------|---------|---------|
| `server/` | `bun run dev` | Gateway API + `/mcp` |
| `client/` | `npm run dev` | Dashboard |
| `woo-mcp/` | `bun run src/index.ts` | Woo upstream |
| `utils-mcp/` | `bun run src/index.ts` | Time/math upstream |
| `notes-mcp/` | `bun run src/index.ts` | Notes upstream |

## Demo checklist

- [ ] Admin: servers show **connected**, tools aggregated
- [ ] Chat: create product + list orders (with LLM key)
- [ ] Member: API key → MCP client `tools/list` / `tools/call`
- [ ] Revoke key → 401 on `/mcp`
- [ ] Disable upstream → tools disappear
- [ ] Audit log shows calls with user attribution

## License

Interview task — you own your implementation; see [problem-statement.md](./problem-statement.md).
