"use client"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Button, buttonVariants } from "@/components/ui/button"
import { MoonIcon, SunIcon, TerminalIcon } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const ROUTE_TITLES: Record<string, string> = {
  "/": "Overview",
  "/dashboard": "Overview",
  "/servers": "Upstream Servers",
  "/servers/new": "Register Server",
  "/tools": "Tools Catalog",
  "/chat": "Chat Agent",
  "/keys": "API Keys & Client Config",
  "/audit": "Audit Log",
  "/members": "Team Members",
  "/settings": "Settings",
}

export function SiteHeader() {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()

  let pageTitle = "Dashboard"
  if (ROUTE_TITLES[pathname]) {
    pageTitle = ROUTE_TITLES[pathname]
  } else if (pathname.startsWith("/servers/")) {
    pageTitle = "Server Details"
  } else if (pathname.startsWith("/chat/")) {
    pageTitle = "Chat Conversation"
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-2 h-4" />
          <h1 className="text-sm font-semibold tracking-tight text-foreground">{pageTitle}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/keys"
            className={cn(
              buttonVariants({ variant: "outline", size: "xs" }),
              "hidden sm:inline-flex gap-1.5 font-mono text-xs text-muted-foreground"
            )}
          >
            <TerminalIcon className="size-3 text-primary" />
            <span>/mcp endpoint</span>
          </Link>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            title="Toggle theme (Press 'd')"
          >
            {resolvedTheme === "dark" ? <SunIcon className="size-3.5" /> : <MoonIcon className="size-3.5" />}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
