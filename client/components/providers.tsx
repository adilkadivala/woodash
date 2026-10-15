"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

function AuthExpiredListener() {
  const router = useRouter()
  const queryClient = useQueryClient()

  React.useEffect(() => {
    const onExpired = () => {
      queryClient.clear()
      router.push("/login")
    }
    window.addEventListener("auth:expired", onExpired)
    return () => window.removeEventListener("auth:expired", onExpired)
  }, [queryClient, router])

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
            retry: 1,
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
