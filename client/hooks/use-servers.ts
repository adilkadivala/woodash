"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api, MOCK_SERVERS } from "@/lib/api"
import type { UpstreamServer } from "@/types/api"
import { toast } from "sonner"

export function useServers() {
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery<{ servers: UpstreamServer[] }>({
    queryKey: ["servers"],
    queryFn: () => api<{ servers: UpstreamServer[] }>("/servers"),
    refetchInterval: 10000, // Poll every 10s as specified in architecture doc
  })

  const servers = data?.servers || MOCK_SERVERS

  const enableMutation = useMutation({
    mutationFn: (id: string) => api(`/servers/${id}/enable`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] })
      queryClient.invalidateQueries({ queryKey: ["tools"] })
      toast.success("Server enabled successfully")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to enable server")
    },
  })

  const disableMutation = useMutation({
    mutationFn: (id: string) => api(`/servers/${id}/disable`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] })
      queryClient.invalidateQueries({ queryKey: ["tools"] })
      toast.success("Server disabled. Associated tools removed from aggregator.")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to disable server")
    },
  })

  const refreshMutation = useMutation({
    mutationFn: (id: string) => api(`/servers/${id}/refresh`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] })
      queryClient.invalidateQueries({ queryKey: ["tools"] })
      toast.success("Server refreshed and tools re-indexed")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to refresh server")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/servers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] })
      queryClient.invalidateQueries({ queryKey: ["tools"] })
      toast.success("Server removed. Its tools are no longer available.")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete server")
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api<{ server: UpstreamServer }>("/servers", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] })
      queryClient.invalidateQueries({ queryKey: ["tools"] })
      toast.success("Upstream server registered successfully")
    },
  })

  return {
    servers,
    isLoading,
    error,
    refetch,
    enableServer: enableMutation.mutate,
    disableServer: disableMutation.mutate,
    refreshServer: refreshMutation.mutate,
    deleteServer: deleteMutation.mutate,
    createServer: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  }
}
