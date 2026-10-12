# MCP Gateway Dashboard: Frontend Architecture

Stack: **Next.js (App Router) + TypeScript + shadcn/ui** (already set up).
Companion to `backend-architecture.md`. Every route, field and error shape here maps to an endpoint defined there.

---

## 1. What the dashboard is for

| User | Needs to do |
|---|---|
| **Admin** | Register, test, enable/disable and remove upstream MCP servers. Invite and manage members. See everything in audit. |
| **Member** | See which tools exist, mint and revoke their own API keys, chat with the agent, see their own audit history. |
| **Both** | Copy a ready-made config snippet to connect an external MCP client (Claude Desktop, Cursor, etc.) to the single `/mcp` endpoint. |

The assignment's evaluation scenarios must be visibly demonstrable from this UI:
add a server → tools appear in chat → kill an upstream → UI shows `unreachable`, others still work → revoke a key → external client gets 401 → disable a server → tools vanish → audit shows all of it.

---

## 2. Key decisions

| Decision | Choice | Why |
|---|---|---|
| Talking to the backend | Next.js **rewrite** `/api/*` → gateway service | Same origin, so the session cookie works with no CORS and no tokens in JS |
| Auth | HttpOnly session cookie set by gateway; `middleware.ts` redirects when absent | Nothing sensitive in `localStorage` |
| Data fetching | **TanStack Query** | Caching, polling for server health, mutations with invalidation |
| Forms | **react-hook-form + zod** (shadcn `Form`) | One schema per form, errors map to fields |
| Chat streaming | `fetch` + `ReadableStream` SSE parser | `EventSource` cannot POST |
| Tables | shadcn `Table` + **TanStack Table** | Audit and members need sorting and filters |
| Toasts | `sonner` | Ships with shadcn |
| Rendering untrusted text | Plain text / sanitized markdown only | Tool results and LLM output are untrusted (prompt-injection and XSS surface) |
| Server components | Used for layout and the initial auth check; interactive pages are client components | Keeps data hooks simple |

`next.config.ts`:

```ts
const nextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.GATEWAY_URL}/api/:path*` }];
  },
  output: 'standalone',   // small Docker image for Helm
};
export default nextConfig;
```

`GATEWAY_URL` is `http://localhost:4000` locally and `http://gateway.platform.svc:4000` in-cluster. In production the dashboard and `/mcp` sit behind the same ingress host, with `/mcp` routed straight to the gateway.

Note: SSE through a Next.js rewrite can buffer. If chat tokens arrive in one lump, route `/api/chat/*` straight to the gateway at the ingress level, or send `X-Accel-Buffering: no` from the backend.

---

## 3. Route map

```
app/
├─ (public)/
│  ├─ login/page.tsx                     Sign in
│  └─ invite/[token]/page.tsx            Accept invite, set name + password
├─ (app)/                                Authenticated shell (sidebar + topbar)
│  ├─ layout.tsx                         Auth guard, nav, role gating
│  ├─ page.tsx                           Overview (health + getting-started checklist)
│  ├─ servers/
│  │  ├─ page.tsx                        List of upstream servers
│  │  ├─ new/page.tsx                    Add server (admin)
│  │  └─ [id]/page.tsx                   Detail: status, tools, edit, danger zone
│  ├─ tools/page.tsx                     Aggregated tool catalog + search
│  ├─ chat/
│  │  ├─ page.tsx                        New chat / redirect to latest
│  │  └─ [conversationId]/page.tsx       Conversation
│  ├─ keys/page.tsx                      API keys + "Connect a client" snippets
│  ├─ audit/page.tsx                     Audit log
│  ├─ members/page.tsx                   Members + invites (admin)
│  └─ settings/page.tsx                  Profile, password, theme
├─ not-found.tsx
├─ error.tsx
└─ layout.tsx                            Providers, Toaster, ThemeProvider
```

### Navigation (sidebar)

| Item | Icon (lucide) | Admin | Member |
|---|---|---|---|
| Overview | `LayoutDashboard` | ✔ | ✔ |
| Chat | `MessageSquare` | ✔ | ✔ |
| Servers | `Server` | ✔ (manage) | ✔ (read-only) |
| Tools | `Wrench` | ✔ | ✔ |
| API keys | `KeyRound` | ✔ | ✔ |
| Audit log | `ScrollText` | ✔ (all) | ✔ (own) |
| Members | `Users` | ✔ | hidden |
| Permissions *(bonus)* | `ShieldCheck` | ✔ | hidden |
| Settings | `Settings` | ✔ | ✔ |

Hiding a link is a convenience only. The backend enforces roles, and the UI must still handle a `403`.

---

## 4. Pages in detail

### 4.1 Login `/login`
- Email + password form. `POST /api/auth/login`.
- Errors: generic "Invalid email or password" (never reveal which). Disabled account: "Your account is disabled, contact an admin".
- On success, redirect to `?next=` if it is a same-origin path, else `/`.
- No public sign-up link; membership is invite-only.

### 4.2 Accept invite `/invite/[token]`
- Form: name, password, confirm password (zod: min 12 chars, match).
- `POST /api/auth/accept-invite {token, name, password}`.
- Expired, used or invalid token → friendly card "This invite is no longer valid. Ask your admin for a new one."
- On success, auto-login and go to `/` (which shows the onboarding checklist).

### 4.3 Overview `/`
Two zones:

**A. Getting-started checklist** (shown until all done, then collapsed into a small "Setup complete" chip). Each step derives its state from real data, nothing stored client-side:

| Step | Done when | CTA |
|---|---|---|
| 1. Register an MCP server *(admin)* | `GET /api/servers` has ≥ 1 | Add server |
| 2. See the combined tools | `GET /api/tools` has ≥ 1 | Browse tools |
| 3. Create an API key | `GET /api/keys` has ≥ 1 | Create key |
| 4. Connect an external client | Any audit row with `via = 'mcp'` for me | Show snippet |
| 5. Try the chat agent | ≥ 1 conversation | Open chat |
| 6. Invite a teammate *(admin)* | `GET /api/members` has ≥ 2 | Invite |

Members see only the steps that apply to them.

**B. Live health**
- Stat cards: servers connected / unreachable / disabled, total tools, calls in last 24h, error rate.
- Server status list with colored badges, polling `GET /api/servers` every 10s.
- Recent activity: last 10 audit rows.
- Alert banner if any server has a changed `toolsDigest` (poisoning warning) or is `unreachable`.

### 4.4 Servers `/servers`
- Table: name, slug, URL (host only), status badge, tool count, last checked (relative time), enabled switch, row actions (Refresh, Edit, Delete).
- Status badge: `connected` green, `unreachable` red, `disabled` grey. Tooltip shows `lastError`.
- Admin: "Add server" button. Member: read-only (no switch, no actions).
- Poll every 10s via TanStack Query `refetchInterval`.
- Toggling enable/disable calls `POST /api/servers/:id/enable|disable`, optimistic update, rollback on error.
- Delete uses a confirmation `AlertDialog` that states: "Its tools will disappear for chat and all MCP clients."

### 4.5 Add / edit server `/servers/new`, `/servers/[id]`

Form fields (zod):

| Field | Rule |
|---|---|
| `name` | required, 1–60 chars |
| `slug` | `^[a-z][a-z0-9-]{0,31}$`, auto-suggested from name, **immutable after create** |
| `url` | valid http(s) URL |
| `authType` | `none` / `bearer` / `header` |
| `authHeaderName` | required when `header` |
| `credential` | required when authType ≠ none on create; **write-only**, see below |
| `enabled` | default true |

UX rules:
- **Test connection** button → `POST /api/servers/test`. Shows connected or the error, plus a preview list of discovered tools. Save is allowed even if the test fails (admin may add a server that is temporarily down), with a warning.
- Credential field is a password input. On edit, it shows "•••••• (stored, leave blank to keep)". The API never returns the secret; the UI only knows `hasCredential`.
- SSRF rejections from the backend (`code: URL_NOT_ALLOWED`) show inline under the URL field with the reason.
- Slug conflicts (`SLUG_TAKEN`) show inline under slug.

Detail page tabs:
1. **Overview**: status, last checked, last error, tools digest, "Refresh now" (`POST .../refresh`).
2. **Tools**: `GET /api/servers/:id/tools`, name, description, input-schema viewer (collapsible JSON).
3. **Settings**: edit form.
4. **Danger zone**: disable, delete.

### 4.6 Tools `/tools`
- `GET /api/tools` (same list an external MCP client sees for this principal).
- Search box, filter by server (chips), group by server.
- Each tool card: namespaced name (`woo__list_orders`) with copy button, description, "View schema" drawer.
- Empty state: "No tools yet. Ask an admin to register an MCP server."
- Banner if some servers are unreachable: "Tools from `<slug>` are currently unavailable."

### 4.7 Chat `/chat`, `/chat/[conversationId]`
Layout: left rail with conversations, main pane with messages, composer at bottom.

**Message rendering**
- User messages: plain text.
- Assistant messages: sanitized markdown (`react-markdown` + `rehype-sanitize`, no raw HTML).
- **Tool call cards** inline in the stream, one per call:
  - Running: spinner + `woo__list_orders` + collapsed args.
  - Done: green check + duration + result summary; expand to see args and result (rendered as formatted JSON in `<pre>`, never as HTML).
  - Failed/denied/timeout: red or amber card with the error code and message.
- Banner for loop-guard messages ("Stopped after N tool calls").

**Streaming (SSE) parser**

```ts
// lib/sse.ts
export async function* streamChat(conversationId: string, message: string, signal: AbortSignal) {
  const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ message }),
    signal,
  });
  if (!res.ok || !res.body) throw await toApiError(res);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i;
    while ((i = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = /^event: (.+)$/m.exec(frame)?.[1];
      const data = /^data: (.+)$/m.exec(frame)?.[1];
      if (ev && data) yield { type: ev, data: JSON.parse(data) };
    }
  }
}
```

Event handling (matches backend): `token` appends text, `tool_call` adds a running card, `tool_result` completes it, `error` shows an inline error, `done` re-enables the composer.

**Controls**
- Stop button aborts the `AbortController`.
- Enter sends, Shift+Enter newline. Composer disabled while streaming.
- Auto-scroll only if the user is already near the bottom.
- "New chat" creates a conversation (`POST /api/chat/conversations`), title auto-set from the first message.
- Empty state shows 3 example prompts that fit the demo: "List my last 5 orders", "Create a product called …", "What time is it in Tokyo?".

### 4.8 API keys `/keys`
- Table: name, prefix (`kgw_ab12cd…`), created, last used, status (active/revoked), Revoke action. Admin sees a user column and filter.
- **Create key** dialog: name → `POST /api/keys` → response contains plaintext **once**.
- **Reveal-once modal**: shows the key in a monospace field with a Copy button, and a warning "You won't be able to see this again." Closing requires ticking "I've copied it" (or pressing the copy button). The key lives only in component state and is cleared on close; never put it in a URL, query cache, or `localStorage`.
- Revoke: `AlertDialog` → `DELETE /api/keys/:id` → row turns "Revoked".

**Connect a client** panel (below the table), tabs with copy buttons. The host is derived from `window.location.origin`:

```jsonc
// Claude Desktop / Cursor style (via mcp-remote bridge)
{
  "mcpServers": {
    "team-gateway": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<host>/mcp",
               "--header", "Authorization: Bearer <YOUR_KEY>"]
    }
  }
}
```

```bash
# curl smoke test
curl -s https://<host>/mcp \
  -H 'Authorization: Bearer <YOUR_KEY>' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Keep the snippet's key as a literal placeholder `<YOUR_KEY>`; never auto-fill a real key.

### 4.9 Audit log `/audit`
- Table columns: time, user, via (`mcp`/`chat`), server, tool, outcome badge, duration, error code.
- Filters (bound to URL query so views are shareable): user (admin only), server, tool, outcome, date range.
- Cursor pagination ("Load more") using `cursor` from the API.
- Row click opens a side sheet: full row, `args_hash`, error message, API key prefix used.
- Outcome colors: success green, error red, denied amber, timeout orange.
- Members see only their own rows (backend enforces; UI hides the user filter).
- Optional "Auto-refresh" toggle (poll 5s) to make the demo live.

### 4.10 Members `/members` (admin)
- Table: name, email, role (select), status, joined, actions (Disable/Enable, Remove).
- **Invite member** dialog: email + role → `POST /api/members/invite` → shows the invite link with Copy (email sending is out of scope; the admin shares the link). Pending invites listed with expiry and "Revoke invite".
- Role change and disable use `PATCH /api/members/:id`. Guard: an admin cannot demote or disable themselves (disable the control and explain why).
- Remove: confirmation stating "This revokes all of their API keys."

### 4.11 Settings `/settings`
- Profile (name, email read-only), change password, theme toggle (light/dark/system).
- "Sign out" button → `POST /api/auth/logout`.

### 4.12 Permissions *(bonus, admin)* `/permissions`
- Matrix: rows = tools grouped by server, columns = roles (admin, member), each cell a tri-state (allow / deny / default).
- Writes `tool_policies` rows. Shows effective result with "deny beats allow" explanation.
- Include a "Test as member" dry-run drawer if time allows.

### 4.13 Not found / error
- `not-found.tsx`: simple card with link home.
- `error.tsx`: "Something went wrong" with Retry; log nothing sensitive.

---

## 5. Onboarding flow, end to end

1. **Day 0, bootstrap admin**: the backend seeds an admin from `BOOTSTRAP_ADMIN_EMAIL/PASSWORD`. They log in and land on Overview with the checklist.
2. **Admin adds the first upstream** (Woo MCP). The form's Test button shows discovered tools before saving.
3. **Admin invites teammates**: copies invite links.
4. **Member accepts invite**: sets password, lands on Overview showing member steps (keys, tools, chat).
5. **Member creates a key**, copies the snippet into their MCP client, makes a call; step 4 ticks automatically from audit data.
6. Checklist collapses once finished.

Empty states everywhere explain the next action instead of showing a blank table.

---

## 6. Auth and route protection

```ts
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
const PUBLIC = ['/login', '/invite'];
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has('sid');          // cookie name set by gateway
  const isPublic = PUBLIC.some(p => pathname.startsWith(p));
  if (!hasSession && !isPublic) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && pathname === '/login') return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next|favicon.ico|api).*)'] };
```

Middleware only checks that a cookie exists (cheap). The real check is `GET /api/auth/me` in the `(app)` layout; a `401` from any API call clears the query cache and redirects to `/login`.

`useMe()` hook returns `{ user, isAdmin }`; a small `<AdminOnly>` wrapper hides admin UI.

---

## 7. API client, types and errors

```ts
// lib/api.ts
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'same-origin',
  });
  if (res.status === 401) { window.dispatchEvent(new Event('auth:expired')); }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? res.statusText);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
```

Shared types (`types/api.ts`), mirroring the backend:

```ts
export type Role = 'admin' | 'member';
export type ServerStatus = 'connected' | 'unreachable' | 'disabled';
export type Outcome = 'success' | 'error' | 'denied' | 'timeout';

export interface User { id: string; email: string; name: string; role: Role; disabled: boolean; createdAt: string }
export interface ApiKey { id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null; userId?: string }
export interface UpstreamServer {
  id: string; slug: string; name: string; url: string; enabled: boolean;
  authType: 'none' | 'bearer' | 'header'; authHeaderName?: string; hasCredential: boolean;
  status: ServerStatus; lastError: string | null; lastCheckedAt: string | null;
  toolCount: number; toolsDigestChanged?: boolean;
}
export interface Tool { name: string; server: string; description: string; inputSchema: unknown }
export interface AuditRow {
  id: number; ts: string; userId: string | null; via: 'mcp' | 'chat'; serverSlug: string | null;
  toolName: string | null; durationMs: number | null; outcome: Outcome; errorCode: string | null; errorMessage: string | null;
}
export type ChatEvent =
  | { type: 'token'; data: { text: string } }
  | { type: 'tool_call'; data: { id: string; name: string; args: unknown } }
  | { type: 'tool_result'; data: { id: string; name: string; ok: boolean; durationMs: number; summary: string } }
  | { type: 'error'; data: { code: string; message: string } }
  | { type: 'done'; data: Record<string, never> };
```

Error code → UI mapping (extend as backend grows):

| Code | UI |
|---|---|
| `UNAUTHENTICATED` | redirect to login |
| `FORBIDDEN` | toast "You don't have permission" |
| `SLUG_TAKEN` | inline field error |
| `URL_NOT_ALLOWED` | inline field error on URL |
| `UPSTREAM_TIMEOUT` / `UPSTREAM_UNREACHABLE` | amber toast, status refetch |
| `RATE_LIMITED` | toast with retry hint |
| anything else | generic toast with `message` |

Query keys: `['me']`, `['servers']`, `['servers', id]`, `['tools']`, `['keys']`, `['audit', filters]`, `['members']`, `['conversations']`, `['messages', id]`. Every mutation invalidates the matching key; server mutations also invalidate `['tools']`.

---

## 8. shadcn/ui components to install

```bash
npx shadcn@latest add button input label textarea select switch checkbox \
  form card badge table tabs dialog alert-dialog sheet dropdown-menu \
  tooltip skeleton sonner separator scroll-area avatar sidebar \
  alert progress popover command calendar collapsible
```

Extra packages:

```bash
npm i @tanstack/react-query @tanstack/react-table react-hook-form zod \
  @hookform/resolvers react-markdown rehype-sanitize date-fns lucide-react next-themes
```

Custom components to build on top:

| Component | Purpose |
|---|---|
| `StatusBadge` | colored badge for server status and audit outcome |
| `CopyButton` | clipboard with "Copied" feedback |
| `RevealOnceDialog` | shows a secret once, requires acknowledgement |
| `ConfirmDialog` | wraps `AlertDialog` for destructive actions |
| `EmptyState` | icon + text + CTA |
| `DataTable` | TanStack Table wrapper with loading skeleton and empty state |
| `JsonViewer` | collapsible, read-only, escapes content |
| `ToolCallCard` | chat tool call, with running/ok/error states |
| `ChecklistCard` | onboarding steps from live data |
| `RelativeTime` | "3m ago" with absolute time in tooltip |
| `AdminOnly` | role-gated render |

---

## 9. Folder structure

```
apps/dashboard/
├─ app/                        (routes from section 3)
├─ components/
│  ├─ ui/                      shadcn generated
│  ├─ layout/                  AppSidebar, Topbar, PageHeader
│  ├─ servers/                 ServerTable, ServerForm, ToolList, TestConnection
│  ├─ chat/                    ChatShell, MessageList, Composer, ToolCallCard, ConversationRail
│  ├─ keys/                    KeyTable, CreateKeyDialog, ConnectSnippets
│  ├─ audit/                   AuditTable, AuditFilters, AuditDetailSheet
│  ├─ members/                 MemberTable, InviteDialog
│  ├─ overview/                StatCards, ChecklistCard, ActivityFeed
│  └─ shared/                  StatusBadge, CopyButton, EmptyState, ConfirmDialog, DataTable
├─ hooks/                      useMe, useServers, useTools, useKeys, useAudit, useChat
├─ lib/                        api.ts, sse.ts, utils.ts, schemas.ts (zod), constants.ts
├─ types/api.ts
├─ providers/                  QueryProvider, ThemeProvider
├─ middleware.ts
├─ next.config.ts
├─ Dockerfile
└─ .env.example                GATEWAY_URL=http://localhost:4000
```

---

## 10. Security checklist (frontend)

- No tokens, keys or secrets in `localStorage`/`sessionStorage`. Session is an HttpOnly cookie.
- API key plaintext exists only inside `RevealOnceDialog` state; cleared on close; excluded from React Query cache and logs.
- Credentials are write-only: forms never prefill them.
- Render tool results and LLM output as text or sanitized markdown. Never `dangerouslySetInnerHTML`.
- External links in chat get `rel="noopener noreferrer"`.
- `?next=` redirect accepts only same-origin paths starting with `/` and not `//`.
- Security headers via `next.config.ts` `headers()`: `Content-Security-Policy` (self + inline styles needed by shadcn), `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`.
- Destructive actions (delete server, remove member, revoke key) always confirm.
- UI role gating is cosmetic; every action must still handle `403`.
- Disable browser autofill on credential fields (`autoComplete="off"` / `new-password`).

---

## 11. UX details worth doing

- Loading: skeletons, not spinners, for tables and cards.
- Optimistic updates for enable/disable and role change; rollback on failure.
- Relative timestamps with absolute time on hover.
- Keyboard: `/` focuses search on Tools, `Cmd+K` command palette (jump to page, search tools), Enter sends chat.
- Responsive: sidebar collapses to a sheet below `md`; tables scroll horizontally.
- Dark mode via `next-themes`; use shadcn tokens only, no hard-coded colors.
- Accessible: status is never color-only (badge text + icon), dialogs trap focus (shadcn default), labels on all inputs.
- Dead-upstream demo moment: when a server flips to `unreachable`, the row animates to red and a toast says "`utils` is unreachable. Its tools are hidden; other servers are unaffected."

---

## 12. Deployment (Helm)

Dashboard chart (`charts/dashboard`):
- Deployment: `output: 'standalone'` image, port 3000, non-root, readOnlyRootFilesystem with `emptyDir` for `.next/cache`, requests/limits, liveness and readiness on `/`.
- Service: ClusterIP.
- Env: `GATEWAY_URL=http://gateway.platform.svc:4000` (value from `values-*.yaml`, not a Secret; it is not secret).
- Ingress (one host, path routing):
  - `/mcp` → gateway
  - `/api/chat` → gateway (avoids SSE buffering)
  - `/api` → gateway
  - `/` → dashboard
- Local: `gateway.localtest.me` / `dashboard.localtest.me` or a single host with paths. Prod: real hostname plus TLS (cert-manager).

---

## 13. Build order (suggested)

| Step | Deliverable | Needs backend |
|---|---|---|
| 1 | Providers, layout shell, sidebar, theme, `api.ts`, types | no |
| 2 | Login + middleware + `useMe` | auth endpoints |
| 3 | Servers list, add/edit form, test connection, detail with tools | servers endpoints |
| 4 | Tools catalog | `/api/tools` |
| 5 | API keys + reveal-once + connect snippets | keys endpoints |
| 6 | Chat with SSE and tool-call cards | chat endpoints |
| 7 | Audit log with filters | audit endpoint |
| 8 | Members + invite + accept-invite page | members endpoints |
| 9 | Overview with checklist and health polling | existing data |
| 10 | Empty states, errors, responsive polish, Dockerfile | no |
| 11 | Bonus: permissions matrix | policies endpoints |

Tip: until the backend exists, mock with MSW or a tiny JSON fixture layer behind `api.ts`, so pages 3–9 can be built in parallel with the gateway.

---

## 14. Demo-video script (pages in order)

1. Login as admin → Overview checklist.
2. Servers → Add Woo MCP (Test connection → tools preview) → Save → status `connected`.
3. Add `utils-mcp` the same way.
4. Tools → show namespaced tools from both servers.
5. Chat → "list my last 3 orders, and what time is it in Tokyo?" → both tool-call cards stream.
6. Keys → create key (reveal-once) → paste snippet into an external MCP client → list and call a tool.
7. Kill `utils-mcp` pod → Servers page flips to `unreachable`; Woo tools still work in chat.
8. Revoke the key → external client call returns 401.
9. Disable Woo server → tools disappear in Tools page, chat and external client.
10. Audit → show every call, denial, and failure with attribution.
11. Members → invite a teammate, show the invite link, accept in a private window.

---

## 15. Done checklist

- [ ] Every page above renders loading, empty and error states
- [ ] Admin vs member views verified (member cannot see admin UI; direct URL gives a clean 403 state)
- [ ] API key plaintext appears exactly once and is not in network responses afterwards
- [ ] Chat shows `tool_call` / `tool_result` live and handles abort
- [ ] Server status updates without a manual refresh
- [ ] SSRF and slug errors show inline
- [ ] No `dangerouslySetInnerHTML`; CSP and security headers set
- [ ] Production build runs in the container behind the Helm ingress
