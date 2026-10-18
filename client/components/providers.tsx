"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

function AuthExpiredListener() {
  const queryClient = useQueryClient()
  const handling = React.useRef(false)

  React.useEffect(() => {
    const onExpired = () => {
      if (handling.current) return
      handling.current = true
      void queryClient.cancelQueries()
      void fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).finally(() => {
        queryClient.clear()
        window.location.replace("/login")
      })
    }
    window.addEventListener("auth:expired", onExpired)
    return () => window.removeEventListener("auth:expired", onExpired)
  }, [queryClient])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
            refetchOnWindowFocus: false,
            retry: (count, error) => {
              const status = (error as { status?: number })?.status
              if (status === 401 || status === 403) return false
              return count < 1
            },
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthExpiredListener />
        {children}
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
