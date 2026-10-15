"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api, MOCK_KEYS } from "@/lib/api"
import { useMockApi } from "@/lib/gateway"
import type { ApiKey } from "@/types/api"
import { toast } from "sonner"

export function useKeys() {
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery<{ keys: ApiKey[] }>({
    queryKey: ["keys"],
    queryFn: () => api<{ keys: ApiKey[] }>("/keys"),
  })

  const keys = data?.keys ?? (useMockApi ? MOCK_KEYS : [])

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      api<{ key: ApiKey; plaintext: string }>("/keys", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keys"] })
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create API key")
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api(`/keys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keys"] })
      toast.success("API key revoked. External clients using it will receive 401.")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to revoke API key")
    },
  })

  return {
    keys,
    isLoading,
    error,
    refetch,
    createKey: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    revokeKey: revokeMutation.mutate,
    isRevoking: revokeMutation.isPending,
  }
}
