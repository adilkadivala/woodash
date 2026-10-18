"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { useMe } from "@/hooks/use-me"
import type { Store } from "@/types/api"
import { toast } from "sonner"

export function useStores() {
  const queryClient = useQueryClient()
  const { user } = useMe()

  const { data, isLoading, error, refetch } = useQuery<{
    stores: Store[]
    maxStoresPerUser: number
    kubernetes: boolean
  }>({
    queryKey: ["stores"],
    queryFn: () => api("/stores"),
    enabled: !!user,
    refetchInterval: (query) => {
      if (!user) return false
      const stores = query.state.data?.stores ?? []
      const busy = stores.some((s) => s.status === "provisioning" || s.status === "deleting")
      return busy ? 4000 : 15000
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: { name: string; slug?: string }) =>
      api<{ store: Store }>("/stores", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] })
      toast.success("Store provisioning started")
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create store")
    },
  })

  const retryMutation = useMutation({
    mutationFn: (id: string) => api<{ store: Store }>(`/stores/${id}/retry`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] })
      toast.success("Retrying store provision")
    },
    onError: (err: Error) => {
      toast.error(err.message || "Retry failed")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api<{ store: Store }>(`/stores/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] })
      queryClient.invalidateQueries({ queryKey: ["servers"] })
      queryClient.invalidateQueries({ queryKey: ["tools"] })
      toast.success("Store teardown started")
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete store")
    },
  })

  return {
    stores: data?.stores ?? [],
    maxStoresPerUser: data?.maxStoresPerUser ?? 3,
    kubernetes: data?.kubernetes ?? false,
    isLoading,
    error,
    refetch,
    createStore: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    retryStore: retryMutation.mutateAsync,
    isRetrying: retryMutation.isPending,
    deleteStore: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  }
}
