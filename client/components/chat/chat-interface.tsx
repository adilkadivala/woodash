"use client"

import { useState, useRef, useEffect } from "react"
import { streamChat } from "@/lib/sse"
import { ToolCallCard, type ToolCallState } from "./tool-call-card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  MessageSquareIcon,
  SendIcon,
  SquareIcon,
  PlusIcon,
  BotIcon,
  UserIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import rehypeSanitize from "rehype-sanitize"
import type { Conversation } from "@/types/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useMessages,
} from "@/hooks/use-chat"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  toolCalls?: ToolCallState[]
}

const EXAMPLE_PROMPTS = [
  "List my last 5 orders and check their fulfillment status.",
  "What is the current time in Tokyo, and convert 150 USD to EUR.",
  "Check products in the WooCommerce store and suggest restock items.",
]

export function ChatInterface({
  initialConversationId,
}: {
  initialConversationId?: string
}) {
  const { data: convData, isLoading: convLoading } = useConversations()
  const createConversation = useCreateConversation()
  const deleteConversation = useDeleteConversation()

  const conversations = convData?.conversations ?? []

  const [activeConvId, setActiveConvId] = useState<string | undefined>(
    initialConversationId
  )

  useEffect(() => {
    if (activeConvId) return
    if (conversations.length > 0) {
      setActiveConvId(conversations[0].id)
    }
  }, [conversations, activeConvId])

  const { data: msgData } = useMessages(activeConvId)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    if (!msgData?.messages) {
      setMessages([])
      return
    }
    setMessages(
      msgData.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content || "",
        }))
    )
  }, [msgData, activeConvId])

  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isStreaming])

  const handleCreateNewChat = async () => {
    try {
      const { conversation } = await createConversation.mutateAsync("New chat")
      setActiveConvId(conversation.id)
      setMessages([])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create conversation")
    }
  }

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteConversation.mutate(id, {
      onSuccess: () => {
        if (activeConvId === id) {
          const next = conversations.filter((c) => c.id !== id)
          setActiveConvId(next[0]?.id)
          setMessages([])
        }
        toast.success("Conversation deleted")
      },
      onError: (err: Error) => toast.error(err.message || "Failed to delete"),
    })
  }

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || input).trim()
    if (!content || isStreaming) return

    let convId = activeConvId
    if (!convId) {
      try {
        const { conversation } = await createConversation.mutateAsync(
          content.slice(0, 36) + (content.length > 36 ? "..." : "")
        )
        convId = conversation.id
        setActiveConvId(convId)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to start conversation")
        return
      }
    }

    setInput("")

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content,
    }

    const assistantMsgId = `msg-${Date.now()}-assistant`
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      toolCalls: [],
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)

    // Update conversation title from first user message if default
    const activeConv = conversations.find((c) => c.id === convId)
    if (activeConv && (activeConv.title === "New chat" || messages.length === 0)) {
      /* title updates are cosmetic; server keeps initial title */
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const generator = streamChat(convId, content, controller.signal)

      for await (const event of generator) {
        if (event.type === "token") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: m.content + event.data.text }
                : m
            )
          )
        } else if (event.type === "tool_call") {
          const newCall: ToolCallState = {
            id: event.data.id,
            name: event.data.name,
            arguments: event.data.arguments,
            status: "running",
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, toolCalls: [...(m.toolCalls || []), newCall] }
                : m
            )
          )
        } else if (event.type === "tool_result") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    toolCalls: (m.toolCalls || []).map((tc) =>
                      tc.id === event.data.id
                        ? {
                            ...tc,
                            status: event.data.ok === false ? "error" : "success",
                            durationMs: event.data.durationMs,
                            result: event.data.result || event.data.summary,
                          }
                        : tc
                    ),
                  }
                : m
            )
          )
        } else if (event.type === "error") {
          toast.error(event.data.message || "Chat agent error")
        } else if (event.type === "done") {
          break
        }
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        toast.error(err.message || "Failed to stream chat")
      }
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsStreaming(false)
      toast.info("Generation stopped by user")
    }
  }

  return (
    <div className="flex h-[calc(100vh-var(--header-height)-5rem)] rounded-xl border bg-card shadow-xs overflow-hidden mx-4 lg:mx-6">
      {/* Left rail - Conversations list */}
      <aside className="w-64 border-r bg-muted/20 flex flex-col justify-between shrink-0 hidden md:flex">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Conversations
          </span>
          <Button
            size="icon-xs"
            variant="outline"
            onClick={handleCreateNewChat}
            title="New Conversation"
          >
            <PlusIcon className="size-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {convLoading && conversations.length === 0 && (
            <p className="text-xs text-muted-foreground px-2">Loading conversations…</p>
          )}
          {conversations.map((conv) => {
            const isActive = conv.id === activeConvId
            return (
              <div
                key={conv.id}
                onClick={() => {
                  setActiveConvId(conv.id)
                }}
                className={cn(
                  "group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquareIcon className="size-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{conv.title}</span>
                </div>
                {conversations.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteChat(conv.id, e)}
                    className={cn(
                      "opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity cursor-pointer",
                      isActive ? "hover:text-primary-foreground/80" : ""
                    )}
                  >
                    <Trash2Icon className="size-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="p-3 border-t bg-muted/10 text-[11px] text-muted-foreground">
          Single call path enforced &bull; All tools verified
        </div>
      </aside>

      {/* Main chat window */}
      <div className="flex flex-1 flex-col justify-between overflow-hidden bg-background">
        {/* Messages feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto py-12">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                <SparklesIcon className="size-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">MCP Gateway Chat Agent</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Interact with your WooCommerce store, run calculations, and execute tools directly via natural language.
              </p>

              <div className="grid grid-cols-1 gap-2 mt-6 w-full text-left">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Try asking:
                </span>
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="rounded-lg border bg-card p-2.5 text-xs text-foreground hover:border-primary/50 hover:bg-muted/40 transition-colors cursor-pointer text-left font-medium"
                  >
                    &ldquo;{prompt}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 text-xs leading-relaxed max-w-3xl",
                  msg.role === "user" ? "ml-auto justify-end" : "mr-auto"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="size-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5">
                    <BotIcon className="size-4" />
                  </div>
                )}

                <div
                  className={cn(
                    "rounded-xl p-3.5 space-y-2",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground font-medium rounded-tr-none"
                      : "bg-muted/40 border text-foreground rounded-tl-none"
                  )}
                >
                  {/* Tool call cards */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {msg.toolCalls.map((tc) => (
                        <ToolCallCard key={tc.id} call={tc} />
                      ))}
                    </div>
                  )}

                  {/* Message content */}
                  {msg.role === "assistant" ? (
                    <div className="prose prose-xs dark:prose-invert max-w-none text-xs">
                      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                        {msg.content || (msg.toolCalls?.length ? "Executing tools..." : "Thinking...")}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="size-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                    <UserIcon className="size-4" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="p-3 border-t bg-card/60 backdrop-blur-xs">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
            className="flex items-end gap-2"
          >
            <Textarea
              placeholder="Ask the agent to check orders, inspect stock, or evaluate tools... (Enter to send, Shift+Enter for newline)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              disabled={isStreaming}
              rows={2}
              className="resize-none text-xs min-h-[52px] max-h-32"
            />

            {isStreaming ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleStopStreaming}
                className="gap-1 cursor-pointer shrink-0 h-[52px]"
              >
                <SquareIcon className="size-3.5 fill-current" />
                Stop
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!input.trim()}
                size="sm"
                className="gap-1 cursor-pointer shrink-0 h-[52px]"
              >
                <SendIcon className="size-3.5" />
                Send
              </Button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
