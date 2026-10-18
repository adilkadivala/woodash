"use client"

import * as React from "react"
import Link from "next/link"
import { NavMain, type NavItem } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  MessageSquareIcon,
  ServerIcon,
  WrenchIcon,
  KeyRoundIcon,
  ScrollTextIcon,
  UsersIcon,
  SettingsIcon,
  LayersIcon,
  StoreIcon,
} from "lucide-react"
import { useMe } from "@/hooks/use-me"
import { useServers } from "@/hooks/use-servers"
import { useTools } from "@/hooks/use-tools"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isAdmin } = useMe()
  const { servers } = useServers()
  const { tools } = useTools()

  const navItems: NavItem[] = [
    {
      title: "Overview",
      url: "/",
      icon: LayoutDashboardIcon,
    },
    {
      title: "Chat Agent",
      url: "/chat",
      icon: MessageSquareIcon,
    },
    {
      title: "Stores",
      url: "/stores",
      icon: StoreIcon,
    },
    {
      title: "Upstream Servers",
      url: "/servers",
      icon: ServerIcon,
      badge: servers.length > 0 ? servers.length : undefined,
    },
    {
      title: "Tools Catalog",
      url: "/tools",
      icon: WrenchIcon,
      badge: tools.length > 0 ? tools.length : undefined,
    },
    {
      title: "API Keys",
      url: "/keys",
      icon: KeyRoundIcon,
    },
    {
      title: "Audit Log",
      url: "/audit",
      icon: ScrollTextIcon,
    },
    {
      title: "Team Members",
      url: "/members",
      icon: UsersIcon,
      adminOnly: true,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: SettingsIcon,
    },
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/" />}
            >
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <LayersIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left">
                <span className="text-sm font-bold tracking-tight">MCP Gateway</span>
                <span className="text-[10px] text-muted-foreground font-mono leading-none">v1.0.0 Enterprise</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navItems} isAdmin={isAdmin} />
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
