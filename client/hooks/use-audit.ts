"use client"

import { useQuery } from "@tanstack/react-query"
import { api, MOCK_AUDIT } from "@/lib/api"
import { useMockApi } from "@/lib/gateway"
import { useMe } from "@/hooks/use-me"
import type { AuditRow } from "@/types/api"
import { useState } from "react"

export interface AuditFilters {
  server?: string
  tool?: string
  outcome?: string
  userId?: string
}

export function useAudit(filters?: AuditFilters, autoRefresh = false) {
  const [cursor, setCursor] = useState<number | undefined>(undefined)

  const queryParams = new URLSearchParams()
  if (filters?.server && filters.server !== "all") queryParams.set("server", filters.server)
  if (filters?.tool && filters.tool !== "all") queryParams.set("tool", filters.tool)
  if (filters?.outcome && filters.outcome !== "all") queryParams.set("outcome", filters.outcome)
  if (filters?.userId && filters.userId !== "all") queryParams.set("userId", filters.userId)
  if (cursor) queryParams.set("cursor", cursor.toString())

  const queryString = queryParams.toString()
  const path = `/audit${queryString ? `?${queryString}` : ""}`

  const { user } = useMe()
  const { data, isLoading, error, refetch } = useQuery<{ logs: AuditRow[]; cursor?: number }>({
    queryKey: ["audit", filters, cursor],
    queryFn: () => api<{ logs: AuditRow[]; cursor?: number }>(path),
    enabled: !!user,
    refetchInterval: autoRefresh && user ? 5000 : false,
  })

  const logs = data?.logs ?? (useMockApi ? MOCK_AUDIT : [])
  const nextCursor = data?.cursor

  return {
    logs,
    nextCursor,
    isLoading,
    error,
    refetch,
    setCursor,
  }
}
