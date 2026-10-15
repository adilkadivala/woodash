"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { useMockApi } from "@/lib/gateway"
import { MOCK_USER } from "@/lib/api"
import type { User } from "@/types/api"
import { useRouter } from "next/navigation"

export function useMe() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery<{ user: User }>({
    queryKey: ["me"],
    queryFn: () => api<{ user: User }>("/auth/me"),
    staleTime: 60 * 1000,
  })

  const logoutMutation = useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    onSettled: () => {
      queryClient.clear()
      router.push("/login")
    },
  })

  const user = data?.user ?? (useMockApi ? MOCK_USER : undefined)
  const isAdmin = user?.role === "admin"

  return {
    user,
    isAdmin,
    isLoading,
    error,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  }
}
