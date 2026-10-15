import { ApiError } from "./api"
import type { ChatEvent } from "@/types/api"

/**
 * Streams chat responses from the gateway's SSE endpoint.
 * Parses `event:` and `data:` chunks robustly.
 */
export async function* streamChat(
  conversationId: string,
  message: string,
  signal?: AbortSignal
): AsyncGenerator<ChatEvent, void, unknown> {
  let res: Response
  try {
    res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      credentials: "same-origin",
      body: JSON.stringify({ message }),
      signal,
    })
  } catch (err: unknown) {
    if (signal?.aborted) return
    throw err
  }

  if (!res.ok || !res.body) {
    const errorBody = await res.json().catch(() => null)
    throw new ApiError(
      res.status,
      errorBody?.error?.code ?? "CHAT_ERROR",
      errorBody?.error?.message ?? "Chat streaming failed"
    )
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ""

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += value

      let i: number
      while ((i = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, i)
        buf = buf.slice(i + 2)

        const evMatch = /^event:\s*(.+)$/m.exec(frame)
        const dataMatch = /^data:\s*(.+)$/m.exec(frame)

        const eventType = (evMatch?.[1]?.trim() || "token") as ChatEvent["type"]
        const dataStr = dataMatch?.[1]?.trim()

        if (dataStr) {
          try {
            const parsedData = JSON.parse(dataStr)
            yield { type: eventType, data: parsedData } as ChatEvent
          } catch {
            // Raw text token fallback
            yield { type: "token", data: { text: dataStr } }
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
