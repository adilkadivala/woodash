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
import type { Conversation, Message } from "@/types/api"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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
  initialConversations = [],
  initialMessages = [],
}: {
  initialConversationId?: string
  initialConversations?: Conversation[]
  initialMessages?: Message[]
}) {
  const [conversations, setConversations] = useState<Conversation[]>(
    initialConversations.length > 0
      ? initialConversations
      : [
          {
            id: "conv-default",
            userId: "u-1",
            title: "Store & Inventory Assistant",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]
  )

  const [activeConvId, setActiveConvId] = useState<string>(
    initialConversationId || conversations[0]?.id || "conv-default"
  )

  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content || "",
    }))
  )

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

  const handleCreateNewChat = () => {
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      userId: "u-1",
      title: "New Conversation",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setConversations([newConv, ...conversations])
    setActiveConvId(newConv.id)
    setMessages([])
  }

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const nextConvs = conversations.filter((c) => c.id !== id)
    setConversations(nextConvs)
    if (activeConvId === id) {
      if (nextConvs.length > 0) {
        setActiveConvId(nextConvs[0].id)
        setMessages([])
      } else {
        handleCreateNewChat()
      }
    }
    toast.success("Conversation deleted")
  }

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || input).trim()
    if (!content || isStreaming) return

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
    const activeConv = conversations.find((c) => c.id === activeConvId)
    if (activeConv && (activeConv.title === "New Conversation" || messages.length === 0)) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId
            ? { ...c, title: content.slice(0, 36) + (content.length > 36 ? "..." : "") }
            : c
        )
      )
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const generator = streamChat(activeConvId, content, controller.signal)

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
          {conversations.map((conv) => {
            const isActive = conv.id === activeConvId
            return (
              <div
                key={conv.id}
                onClick={() => {
                  setActiveConvId(conv.id)
                  // In real app, fetch messages for this conversation
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
