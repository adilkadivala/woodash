"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useMe } from "@/hooks/use-me"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading, error } = useMe()
  const unauthenticated =
    !isLoading && !user && (error as { status?: number } | null)?.status === 401

  React.useEffect(() => {
    if (!unauthenticated) return
    void fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).finally(() => {
      window.location.replace("/login")
    })
  }, [unauthenticated])

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading session…
      </div>
    )
  }

  if (unauthenticated) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Redirecting to sign in…
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        {(error as Error | undefined)?.message ?? "Cannot reach the gateway."}
      </div>
    )
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {children}
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
