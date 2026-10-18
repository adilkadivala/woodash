import type {
  ApiKey,
  AuditRow,
  Conversation,
  Tool,
  UpstreamServer,
  User,
} from "@/types/api"
import { useMockApi } from "@/lib/gateway"

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// Fallback demo fixtures for seamless preview and offline review
export const MOCK_USER: User = {
  id: "u-admin-01",
  email: "admin@gateway.local",
  name: "Platform Admin",
  role: "admin",
  disabled: false,
  createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
}

export const MOCK_SERVERS: UpstreamServer[] = [
  {
    id: "srv-woo",
    slug: "woo",
    name: "WooCommerce Production Store",
    url: "https://shop.example.com/wp-json/mcp",
    enabled: true,
    authType: "bearer",
    hasCredential: true,
    status: "connected",
    lastError: null,
    lastCheckedAt: new Date(Date.now() - 45 * 1000).toISOString(),
    toolCount: 5,
    toolsDigest: "sha256:7f8a9b1c2d3e4f5a",
  },
  {
    id: "srv-utils",
    slug: "utils",
    name: "Time & Math Utility Server",
    url: "http://utils-service.cluster.local:3000/mcp",
    enabled: true,
    authType: "none",
    hasCredential: false,
    status: "connected",
    lastError: null,
    lastCheckedAt: new Date(Date.now() - 120 * 1000).toISOString(),
    toolCount: 3,
    toolsDigest: "sha256:1a2b3c4d5e6f7a8b",
  },
  {
    id: "srv-notes",
    slug: "notes",
    name: "Internal Notes Server",
    url: "http://notes-service.cluster.local:8080/mcp",
    enabled: false,
    authType: "header",
    authHeaderName: "X-Internal-Token",
    hasCredential: true,
    status: "disabled",
    lastError: null,
    lastCheckedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    toolCount: 3,
    toolsDigest: "sha256:3c4d5e6f7a8b9c0d",
  },
]

export const MOCK_TOOLS: Tool[] = [
  {
    name: "woo__list_orders",
    serverSlug: "woo",
    serverName: "WooCommerce Production Store",
    description: "Retrieve paginated orders from WooCommerce store with status filters.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by order status (processing, completed, pending, etc.)" },
        limit: { type: "number", description: "Number of orders to retrieve (max 100)" },
      },
    },
  },
  {
    name: "woo__get_order",
    serverSlug: "woo",
    serverName: "WooCommerce Production Store",
    description: "Get detailed information for a specific order including line items and customer address.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "WooCommerce Order ID" },
      },
      required: ["orderId"],
    },
  },
  {
    name: "woo__update_order_status",
    serverSlug: "woo",
    serverName: "WooCommerce Production Store",
    description: "Update the fulfillment status of an order.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "Order ID" },
        status: { type: "string", enum: ["pending", "processing", "on-hold", "completed", "cancelled", "refunded"] },
      },
      required: ["orderId", "status"],
    },
  },
  {
    name: "woo__list_products",
    serverSlug: "woo",
    serverName: "WooCommerce Production Store",
    description: "List catalog products with stock, pricing, and category filters.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search query" },
        category: { type: "string", description: "Product category slug" },
      },
    },
  },
  {
    name: "woo__create_product",
    serverSlug: "woo",
    serverName: "WooCommerce Production Store",
    description: "Create a new product listing in the store catalog.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Product title" },
        price: { type: "string", description: "Regular price" },
        description: { type: "string", description: "Product description" },
      },
      required: ["name", "price"],
    },
  },
  {
    name: "utils__current_time",
    serverSlug: "utils",
    serverName: "Time & Math Utility Server",
    description: "Get current date, time, and timezone information formatted.",
    inputSchema: {
      type: "object",
      properties: {
        timezone: { type: "string", description: "IANA Timezone string, e.g. 'Asia/Tokyo' or 'UTC'" },
      },
    },
  },
  {
    name: "utils__calculate",
    serverSlug: "utils",
    serverName: "Time & Math Utility Server",
    description: "Evaluate a mathematical expression safely.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Math expression like '12 * 4.5 + 8'" },
      },
      required: ["expression"],
    },
  },
  {
    name: "utils__convert_currency",
    serverSlug: "utils",
    serverName: "Time & Math Utility Server",
    description: "Convert an amount between global fiat currencies.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Source currency (e.g. USD)" },
        to: { type: "string", description: "Target currency (e.g. EUR)" },
        amount: { type: "number", description: "Numeric amount" },
      },
      required: ["from", "to", "amount"],
    },
  },
]

export const MOCK_KEYS: ApiKey[] = [
  {
    id: "key-prod-01",
    name: "Cursor AI IDE Gateway",
    keyPrefix: "kgw_9a8b7c6d",
    createdAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
    lastUsedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    revokedAt: null,
  },
  {
    id: "key-claude-desktop",
    name: "Claude Desktop Team Key",
    keyPrefix: "kgw_1f2e3d4c",
    createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    lastUsedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    revokedAt: null,
  },
  {
    id: "key-staging-old",
    name: "Staging Test Token",
    keyPrefix: "kgw_5a6b7c8d",
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
    lastUsedAt: new Date(Date.now() - 35 * 24 * 3600 * 1000).toISOString(),
    revokedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  },
]

export const MOCK_AUDIT: AuditRow[] = [
  {
    id: 1042,
    ts: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    userId: "u-admin-01",
    via: "chat",
    serverSlug: "woo",
    toolName: "list_orders",
    argsHash: "e3b0c44298fc1c14",
    durationMs: 312,
    outcome: "success",
    errorCode: null,
    errorMessage: null,
    user: { name: "Platform Admin", email: "admin@gateway.local" },
  },
  {
    id: 1041,
    ts: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    userId: "u-admin-01",
    via: "mcp",
    serverSlug: "utils",
    toolName: "current_time",
    argsHash: "a1b2c3d4e5f60718",
    durationMs: 45,
    outcome: "success",
    errorCode: null,
    errorMessage: null,
    user: { name: "Platform Admin", email: "admin@gateway.local" },
  },
  {
    id: 1040,
    ts: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    userId: "u-member-02",
    via: "mcp",
    serverSlug: "woo",
    toolName: "update_order_status",
    argsHash: "f9e8d7c6b5a41234",
    durationMs: 520,
    outcome: "denied",
    errorCode: "POLICY_DENIED",
    errorMessage: "Tool 'woo__update_order_status' denied by policy for role 'member'",
    user: { name: "Sarah Connor", email: "sarah@urumi.ai" },
  },
  {
    id: 1039,
    ts: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    userId: "u-member-02",
    via: "mcp",
    serverSlug: "notes",
    toolName: "get_note",
    argsHash: "445566778899aabb",
    durationMs: 5000,
    outcome: "timeout",
    errorCode: "UPSTREAM_TIMEOUT",
    errorMessage: "Tool call timeout after 15000ms",
    user: { name: "Sarah Connor", email: "sarah@urumi.ai" },
  },
]

export const MOCK_MEMBERS: User[] = [
  {
    id: "u-admin-01",
    name: "Platform Admin",
    email: "admin@gateway.local",
    role: "admin",
    disabled: false,
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: "u-member-02",
    name: "Sarah Connor",
    email: "sarah@urumi.ai",
    role: "member",
    disabled: false,
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: "u-member-03",
    name: "Alex Dev",
    email: "alex@urumi.ai",
    role: "member",
    disabled: true,
    createdAt: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
  },
]

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`/api${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
      credentials: "same-origin",
    })

    if (res.status === 401 && path !== "/auth/login" && path !== "/auth/logout") {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:expired"))
      }
    }

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new ApiError(
        res.status,
        body?.error?.code ?? "UNKNOWN",
        body?.error?.message ?? res.statusText
      )
    }

    return res.status === 204 ? (undefined as T) : res.json()
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (!useMockApi) {
      throw new ApiError(
        502,
        "GATEWAY_UNREACHABLE",
        "Cannot reach the gateway. Start Postgres and run `bun run dev` in server/."
      )
    }
    return getFallbackData<T>(path, init)
  }
}

function getFallbackData<T>(path: string, init?: RequestInit): T {
  const method = (init?.method || "GET").toUpperCase()

  if (path === "/auth/me") return { user: MOCK_USER } as T
  if (path === "/auth/login") return { user: MOCK_USER } as T
  if (path === "/servers" && method === "GET") return { servers: MOCK_SERVERS } as T
  if (path === "/tools" && method === "GET") return { tools: MOCK_TOOLS } as T
  if (path === "/keys" && method === "GET") return { keys: MOCK_KEYS } as T
  if (path.startsWith("/audit") && method === "GET") return { logs: MOCK_AUDIT, cursor: undefined } as T
  if (path === "/members" && method === "GET") return { members: MOCK_MEMBERS } as T
  if (path === "/chat/conversations" && method === "GET") {
    return {
      conversations: [
        {
          id: "conv-1",
          userId: MOCK_USER.id,
          title: "Order Inquiry & Store Analytics",
          createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 1800 * 1000).toISOString(),
        },
      ],
    } as T
  }

  return {} as T
}
