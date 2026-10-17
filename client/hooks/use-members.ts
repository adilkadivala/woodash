"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api, MOCK_MEMBERS } from "@/lib/api"
import { useMockApi } from "@/lib/gateway"
import { useMe } from "@/hooks/use-me"
import type { Invitation, Role, User } from "@/types/api"
import { toast } from "sonner"

export function useMembers() {
  const queryClient = useQueryClient()
  const { user } = useMe()

  const { data, isLoading, error, refetch } = useQuery<{ members: User[] }>({
    queryKey: ["members"],
    queryFn: () => api<{ members: User[] }>("/members"),
    enabled: !!user,
  })

  const members = data?.members ?? (useMockApi ? MOCK_MEMBERS : [])

  const inviteMutation = useMutation({
    mutationFn: (body: { email: string; role: Role }) =>
      api<{ invitation: Invitation }>("/members/invite", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create invitation")
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: Role; disabled?: boolean } }) =>
      api<{ member: User }>(`/members/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] })
      toast.success("Member updated successfully")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update member")
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => api(`/members/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] })
      toast.success("Member removed and their API keys revoked")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove member")
    },
  })

  return {
    members,
    isLoading,
    error,
    refetch,
    inviteMember: inviteMutation.mutateAsync,
    isInviting: inviteMutation.isPending,
    updateMember: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    removeMember: removeMutation.mutate,
    isRemoving: removeMutation.isPending,
  }
}
