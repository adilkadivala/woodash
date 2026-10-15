# WooCommerce MCP Gateway (Urumi Round 1)

Team MCP gateway: React dashboard, Prisma/PostgreSQL backend, custom WooCommerce MCP server (REST, not WP-CLI for tool calls), plus utils and notes MCP servers. Chat and external clients use one `/mcp` endpoint.

## Architecture

```
 MCP client (Bearer kgw_…)          Browser  app.<host>
        |                                  |
        +-------- Ingress -----------------+
                  | /mcp /api              | /
                  v                        v
              Gateway  <---------------- Dashboard
                  |
     executeTool (policy, timeout, breaker, audit)
                  |
     +------------+------------+
     v            v            v
  woo-mcp     utils-mcp    notes-mcp     (ClusterIP only)
     |
  Woo REST  ←  WordPress + WooCommerce + MariaDB (PVCs)
```

Design notes: [docs/system-design.md](./docs/system-design.md), [docs/threat-model.md](./docs/threat-model.md).

**Tool names:** always `slug__tool` (e.g. `woo__list_orders`). Slugs cannot contain `__`.

**Woo MCP → store:** WooCommerce REST API (`/wp-json/wc/v3`) with consumer key/secret from a Kubernetes Secret. REST is versioned and does not need exec into the WordPress pod (unlike WP-CLI). WP-CLI is used only in a one-shot **init Job** to install Woo, enable COD, and insert the REST key.

## Prerequisites

- Docker, [Bun](https://bun.sh) 1.2+, Node 22 (dashboard)
- Optional: `LLM_API_KEY` for chat
- For Kubernetes: Kind (or k3s), Helm 3, kubectl

## Quick start (Docker Compose — real store)

This runs MariaDB, WordPress/Woo (COD), wp-init, three MCP servers, gateway, dashboard.

```bash
docker compose up --build
```

- Storefront: http://localhost:8080 (WP admin `admin` / `admin12345678`)
- Dashboard: http://localhost:3000 (`admin@gateway.local` / `admin12345678`)
- Gateway MCP: http://localhost:4000/mcp

Checkout with **Cash on delivery**. Orders show in WP Admin → WooCommerce → Orders and via `woo__list_orders`.

## Dev loop (gateway + dashboard only)

```bash
docker compose up -d postgres mariadb wordpress wp-init woo-mcp utils-mcp notes-mcp
cd server && cp -n .env.example .env && bun install && bunx prisma db push && bun run dev
cd client && cp -n .env.example .env && npm install && npm run dev
```

Set `WOO_MCP_URL=http://127.0.0.1:4001/mcp` in `server/.env`. If port 4001 is taken, set `PORT` on woo-mcp and match the URL.

## Kubernetes (Kind) — same chart as production

Local domains use **[localtest.me](https://readme.localtest.me/)** which resolves to `127.0.0.1` (no `/etc/hosts` on most machines). Kind maps container :80/:443 to the host.

```bash
chmod +x scripts/*.sh
./scripts/kind-up.sh
```

That will:

1. `kind create cluster --config clusters.yml` (ingress-ready control-plane + workers)
2. Install ingress-nginx
3. Build and `kind load` gateway, dashboard, and MCP images
4. `helm upgrade --install platform ./charts/platform -n platform -f values-local.yaml -f secrets.local.yaml`

URLs:

| What | URL |
|------|-----|
| Storefront | http://store.localtest.me |
| Dashboard | http://app.localtest.me |
| MCP | http://app.localtest.me/mcp |
| API | http://app.localtest.me/api |

Wait until `kubectl -n platform get jobs` shows `wp-init` complete and `woo-mcp` Ready (`/readyz` hits Woo REST).

Passwords: `charts/platform/secrets.local.yaml` (gitignored; generated on first run).

### Helm values (local vs VPS)

| | `values-local.yaml` | `values-prod.yaml` |
|--|---------------------|-------------------|
| Ingress hosts | `*.localtest.me` | your DNS names |
| TLS | off | cert-manager `clusterIssuer` |
| storageClass | `standard` (Kind) | `local-path` (k3s) |
| Images | `*:local` loaded into Kind | registry you push |

Secrets never live in `values-*.yaml`. Use `-f secrets.local.yaml` or `-f secrets.prod.yaml` (`scripts/gen-secrets.sh`).

### VPS / k3s

```bash
# point DNS A records at the VPS; install k3s + ingress-nginx + cert-manager
./scripts/build-images.sh
# tag/push images to your registry; set images.* in values-prod.yaml

helm upgrade --install platform ./charts/platform -n platform --create-namespace \
  -f charts/platform/values-prod.yaml \
  -f secrets.prod.yaml
```

### Upgrade and rollback

```bash
helm upgrade platform ./charts/platform -n platform -f charts/platform/values-local.yaml -f charts/platform/secrets.local.yaml
helm history platform -n platform
helm rollback platform -n platform   # previous revision
```

WordPress and MariaDB use PVCs; rollback restores Deployment images/config, not DB contents. Take a snapshot before store upgrades.

## Connect an external MCP client (user B)

1. Dashboard → API keys → create key (shown once).
2. Gateway URL: `http://app.localtest.me/mcp` (or `http://localhost:4000/mcp` on compose).
3. Header: `Authorization: Bearer kgw_...`

```bash
curl -s http://app.localtest.me/mcp \
  -H 'Authorization: Bearer kgw_YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Revoke the key in the UI; the next call is 401.

## Chat agent

Chat uses **OpenRouter** (`https://openrouter.ai/api/v1`, model `openai/gpt-4o-mini`). Put an `sk-or-v1-…` key in `server/.env` as `LLM_API_KEY`, or `llmApiKey` in the Helm secrets file / `LLM_API_KEY` for compose. The agent calls `executeTool` as the logged-in user (`via=chat` in audit).

## Demo checklist

- [ ] Storefront: add product, COD checkout; order in Woo admin
- [ ] User A chat: create product → appears on storefront; list today’s orders
- [ ] User B MCP client: tools/list + orders; prompt using two servers (e.g. orders + `utils__current_time`)
- [ ] Revoke B’s key → 401
- [ ] Disable an upstream → tools gone from chat and MCP
- [ ] Delete woo-mcp pod → dashboard **unreachable**; utils/notes still work
- [ ] Audit shows each call with the right user

## Scripts

| Path | Purpose |
|------|---------|
| `scripts/kind-up.sh` | Kind + ingress + images + helm |
| `scripts/build-images.sh` | Docker images for Helm |
| `scripts/gen-secrets.sh` | Random secrets YAML |

## License

Interview task — you own your implementation; see [problem-statement.md](./problem-statement.md).
