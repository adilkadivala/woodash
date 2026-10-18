"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { useMe } from "@/hooks/use-me"
import type { Conversation, Message } from "@/types/api"

export function useConversations() {
  const { user } = useMe()
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => api<{ conversations: Conversation[] }>("/chat/conversations"),
    enabled: !!user,
  })
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId && !conversationId.startsWith("conv-"),
    queryFn: () =>
      api<{ messages: Message[] }>(`/chat/conversations/${conversationId}/messages`),
  })
}

export function useCreateConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (title?: string) =>
      api<{ conversation: Conversation }>("/chat/conversations", {
        method: "POST",
        body: JSON.stringify({ title: title || "New chat" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/chat/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
  })
}
