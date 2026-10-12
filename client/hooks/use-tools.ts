"use client"

import { useQuery } from "@tanstack/react-query"
import { api, MOCK_TOOLS } from "@/lib/api"
import type { Tool } from "@/types/api"

export function useTools() {
  const { data, isLoading, error, refetch } = useQuery<{ tools: Tool[] }>({
    queryKey: ["tools"],
    queryFn: () => api<{ tools: Tool[] }>("/tools"),
    staleTime: 15 * 1000,
  })

  const tools = data?.tools || MOCK_TOOLS

  return {
    tools,
    isLoading,
    error,
    refetch,
  }
}
