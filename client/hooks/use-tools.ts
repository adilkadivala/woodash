"use client"

import { useQuery } from "@tanstack/react-query"
import { api, MOCK_TOOLS } from "@/lib/api"
import { useMockApi } from "@/lib/gateway"
import { useMe } from "@/hooks/use-me"
import type { Tool } from "@/types/api"

export function useTools() {
  const { user } = useMe()
  const { data, isLoading, error, refetch } = useQuery<{ tools: Tool[] }>({
    queryKey: ["tools"],
    queryFn: () => api<{ tools: Tool[] }>("/tools"),
    enabled: !!user,
    staleTime: 15 * 1000,
  })

  const tools = data?.tools ?? (useMockApi ? MOCK_TOOLS : [])

  return {
    tools,
    isLoading,
    error,
    refetch,
  }
}
