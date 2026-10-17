# Completion plan — Urumi Round 1 (MCP Gateway on K8s)

_Audit date: 2026-10-17. Deadline: not stated in problem-statement.md ("two weeks").
First commit is 2026-10-12 → assumed deadline **~2026-10-24/26**. Confirm the real date from the invite email._

## Status (updated 2026-10-17, evening)

Done and verified on Kind:
- All definition-of-done flows: COD checkout + WP admin, chat creates product, "orders today",
  user B via Claude Code, cross-server prompt (woo + utils + notes), revoke, disable, dead pod, audit attribution.
- Code fixes: date filter, upstream timeouts/parallel health, MCP 202 notifications, non-root images,
  graceful shutdown, real metrics chart, audit pagination, rate limits, prod default-secret guard,
  admin team-keys (issue/revoke), least-privilege RBAC + admission policy, store REST key bug.
- Bonus: store provisioning + teardown verified end to end.
- Docs: README, system design, threat model, bonus list rewritten.

Remaining:
1. Push repo to GitHub.
2. Demo video (script + record).
3. Optional: VPS k3s deploy; compare-two-stores demo; tool-policy UI.

## P0 — must have (DoD blockers)

1. **Commit current work** (bonus + charts are untracked — one disk accident from losing it).
2. **Deploy on Kind** and make it boot:
   - `scripts/kind-up.sh` default cluster name `cluster-1` vs existing `local` — pick one.
   - Install helm on host; build `mcp-*:local` images; `kind load`.
   - Gateway NetPol egress allows only 443 → in-cluster helm/kubectl needs API server (6443). Add egress rule.
   - Set `LLM_API_KEY` before `gen-secrets.sh`.
3. **Fix DoD-critical code gaps**:
   - `list_orders`: add `after`/`before` (ISO date) params → "orders today" works reliably.
   - Dead-pod test: add timeouts to `client.connect()`, health loop (parallel + timeout), `GET /api/servers` and `/servers/:id/tools` listTools calls — a hung upstream currently can hang the servers page / health checks.
   - New server / provisioned store status `unknown` → shows "Disabled"; trigger an immediate health check on create.
   - `/mcp`: `notifications/*` must return **202** with empty body (Claude Code / Inspector compatibility).
4. **Run the full DoD script on Kind with two users** and fix whatever breaks:
   storefront checkout (COD) → order in WP admin → user A chat creates product → manual order → "orders today" → user B in Claude Code (`claude mcp add --transport http gw http://app.localtest.me/mcp --header "Authorization: Bearer kgw_…"`) → tools list → orders question → cross-server prompt (woo + utils e.g. "total of today's orders in EUR") → revoke B → disable a server (tools vanish in chat + client) → `kubectl delete pod` notes-mcp → dashboard shows Unreachable, others work → audit log shows all, right users.

## P1 — polish that graders will see

5. Remove dummy data: shadcn demo chart on overview, `client/app/dashboard/data.json`, unused template components; fix overview calling admin-only `/members` for members (403).
6. Security quick wins (cheap, and threat model already claims some):
   - `USER bun` in woo/utils/notes Dockerfiles + `securityContext` (runAsNonRoot, drop caps) in charts.
   - Narrow provisioner RBAC: no `"*"` verbs; namespace-scoped resources via explicit verb lists.
   - Fail fast in production if `CREDENTIAL_ENC_KEY` / admin password / MCP tokens are defaults.
   - Woo client: stop sending ck/cs in query string (Basic auth only).
   - Rate limit per user/key (express-rate-limit) — makes the threat-model claim true.
   - Wrap tool results / descriptions as untrusted data in the chat system prompt — makes that claim true.
7. Chat: stream through the Next proxy (don't buffer SSE); persist `toolCalls` so cards survive reload.
8. Audit pagination drops one row per page — fix cursor.

## P1 — docs (mandatory deliverables)

9. README: step-by-step order placement, Claude Code / Cursor / MCP Inspector config snippets, chat usage + LLM key setup, Kind admin credentials location, k3s section (Traefik vs ingress-nginx, DNS, cert-manager, image registry).
10. `docs/system-design.md`: add tradeoffs (REST vs WP-CLI, hand-rolled JSON-RPC endpoint, helm-CLI provisioner vs operator, single replica).
11. `docs/threat-model.md`: remove overclaims or implement them; add "malicious upstream added by admin" section.
12. **"Bonus & stand-outs" section** listing: multi-store, encrypted creds, SSRF guard, default-deny NetPols, circuit breaker, policy engine (partial) — with file paths.
13. Update/delete stale `backend-architecture.md` / `frontend-architecture.md` sections.

## P2 — only if time remains

14. VPS k3s deploy (stand-out #1) — push images to GHCR, fill `values-prod.yaml`, cert-manager TLS.
15. Tool-permission UI for existing `ToolPolicy` engine (stand-out #2 is ~70% done).
16. Bonus demo: two stores, "compare today's orders across stores", delete one store.
17. Helm upgrade/rollback demo (`helm upgrade` new image tag → `helm rollback`).

## P0 — submission

18. Record demo video (script it against the 6 sections in problem-statement.md; rehearse once). Reserve a full day.
19. Push repo to GitHub (public or shared), submit form: https://forms.gle/nftwgyNeenSDmiRb6

## Schedule (assuming deadline ~Oct 24)

| Day | Work |
|---|---|
| Oct 17 (today) | 1 commit, 2 deploy on Kind, 3 code fixes |
| Oct 18 | 4 full DoD run + fixes |
| Oct 19 | 5–8 polish + security |
| Oct 20 | 9–13 docs |
| Oct 21 | 14 VPS deploy and/or 15–17 (pick based on energy) |
| Oct 22 | 18 demo script + recording |
| Oct 23 | Buffer, re-record if needed, 19 submit |
