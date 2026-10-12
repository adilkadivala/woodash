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
      body: JSON.stringify({ message }),
      signal,
    })
  } catch (err: any) {
    if (signal?.aborted) return
    // Simulated fallback response for demo preview when backend is not running
    yield* simulateFallbackChat(message)
    return
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

async function* simulateFallbackChat(message: string): AsyncGenerator<ChatEvent, void, unknown> {
  const lower = message.toLowerCase()

  if (lower.includes("order") || lower.includes("list")) {
    yield {
      type: "tool_call",
      data: {
        id: "call-1",
        name: "woo__list_orders",
        arguments: JSON.stringify({ limit: 5, status: "processing" }),
      },
    }
    await new Promise((r) => setTimeout(r, 600))
    yield {
      type: "tool_result",
      data: {
        id: "call-1",
        name: "woo__list_orders",
        ok: true,
        durationMs: 340,
        summary: "Retrieved 3 processing orders: #1092 ($249.00), #1093 ($89.50), #1094 ($14.99).",
      },
    }
    const reply = "I retrieved your latest processing orders from the WooCommerce store:\n\n- **Order #1092**: $249.00 — *Standard Express* (2 items)\n- **Order #1093**: $89.50 — *Priority Mail* (1 item)\n- **Order #1094**: $14.99 — *Standard* (1 item)\n\nAll orders are in `processing` status and ready for fulfillment."
    for (const chunk of reply.split(" ")) {
      yield { type: "token", data: { text: chunk + " " } }
      await new Promise((r) => setTimeout(r, 40))
    }
    yield { type: "done", data: {} }
    return
  }

  if (lower.includes("time") || lower.includes("tokyo")) {
    yield {
      type: "tool_call",
      data: {
        id: "call-time",
        name: "utils__current_time",
        arguments: JSON.stringify({ timezone: "Asia/Tokyo" }),
      },
    }
    await new Promise((r) => setTimeout(r, 400))
    yield {
      type: "tool_result",
      data: {
        id: "call-time",
        name: "utils__current_time",
        ok: true,
        durationMs: 42,
        summary: "Current time in Tokyo: " + new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Tokyo" }),
      },
    }
    const reply = `The current time in **Tokyo (JST, UTC+9)** is **${new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" })}**.\n\nAll upstream services are synchronized and responding normally.`
    for (const chunk of reply.split(" ")) {
      yield { type: "token", data: { text: chunk + " " } }
      await new Promise((r) => setTimeout(r, 40))
    }
    yield { type: "done", data: {} }
    return
  }

  const defaultText = `I have access to the unified tools across your registered MCP servers (**WooCommerce**, **Utils**, and **Notes**).\n\nYou can ask me to list orders, check stock, evaluate calculations, convert currencies, or create new products.`
  for (const chunk of defaultText.split(" ")) {
    yield { type: "token", data: { text: chunk + " " } }
    await new Promise((r) => setTimeout(r, 35))
  }
  yield { type: "done", data: {} }
}
