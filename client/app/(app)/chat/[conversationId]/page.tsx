"use client"

import { useParams } from "next/navigation"
import { ChatInterface } from "@/components/chat/chat-interface"

export default function ConversationPage() {
  const params = useParams()
  const { conversationId } = params as { conversationId: string }

  return <ChatInterface initialConversationId={conversationId} />
}
