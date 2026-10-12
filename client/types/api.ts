export type Role = "admin" | "member"
export type ServerStatus = "connected" | "unreachable" | "disabled"
export type Outcome = "success" | "error" | "denied" | "timeout"

export interface User {
  id: string
  email: string
  name: string
  role: Role
  disabled: boolean
  createdAt: string
}

export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
  userId?: string
}

export interface UpstreamServer {
  id: string
  slug: string
  name: string
  url: string
  enabled: boolean
  authType: "none" | "bearer" | "header"
  authHeaderName?: string | null
  hasCredential: boolean
  status: ServerStatus
  lastError: string | null
  lastCheckedAt: string | null
  toolCount?: number
  toolsDigest?: string | null
  toolsDigestChanged?: boolean
}

export interface Tool {
  name: string
  serverSlug: string
  serverName: string
  description?: string
  inputSchema?: Record<string, unknown> | null
}

export interface AuditRow {
  id: number
  ts: string
  userId: string | null
  apiKeyId?: string | null
  via: "mcp" | "chat" | "dashboard"
  serverSlug: string | null
  toolName: string | null
  argsHash?: string | null
  durationMs: number | null
  outcome: Outcome
  errorCode: string | null
  errorMessage: string | null
  user?: {
    name: string
    email: string
  }
}

export interface Conversation {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  conversationId: string
  role: "user" | "assistant" | "tool"
  content: string | null
  toolCalls?: any
  createdAt: string
}

export interface Invitation {
  id: string
  email: string
  role: Role
  token?: string
  expiresAt: string
  acceptedAt?: string | null
}

export type ChatEvent =
  | { type: "token"; data: { text: string } }
  | { type: "tool_call"; data: { id: string; name: string; arguments?: string; args?: unknown } }
  | { type: "tool_result"; data: { id: string; name?: string; ok?: boolean; durationMs?: number; result?: string; summary?: string } }
  | { type: "error"; data: { code?: string; message: string } }
  | { type: "done"; data: Record<string, never> }
