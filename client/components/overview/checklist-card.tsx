"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2Icon, CircleIcon, ChevronDownIcon, ChevronUpIcon, SparklesIcon } from "lucide-react"
import Link from "next/link"
import type { UpstreamServer, Tool, ApiKey, AuditRow, User } from "@/types/api"

export function ChecklistCard({
  isAdmin,
  servers,
  tools,
  keys,
  auditLogs,
  members,
}: {
  isAdmin: boolean
  servers: UpstreamServer[]
  tools: Tool[]
  keys: ApiKey[]
  auditLogs: AuditRow[]
  members?: User[]
}) {
  const [collapsed, setCollapsed] = useState(false)

  const steps = [
    ...(isAdmin
      ? [
          {
            id: "servers",
            title: "Register an Upstream MCP Server",
            desc: "Register WooCommerce, Utils, or Notes MCP endpoints into the gateway.",
            done: servers.length > 0,
            href: "/servers",
            cta: "Add Server",
          },
        ]
      : []),
    {
      id: "tools",
      title: "Inspect Unified Tools Catalog",
      desc: "Explore namespaced tool declarations aggregated across active upstreams.",
      done: tools.length > 0,
      href: "/tools",
      cta: "Browse Tools",
    },
    {
      id: "keys",
      title: "Generate an API Key",
      desc: "Mint a Bearer token with kgw_ prefix to connect external MCP clients.",
      done: keys.length > 0,
      href: "/keys",
      cta: "Create Key",
    },
    {
      id: "mcp-call",
      title: "Connect External Client (Cursor / Claude / curl)",
      desc: "Call the unified /mcp endpoint with your API key.",
      done: auditLogs.some((a) => a.via === "mcp"),
      href: "/keys",
      cta: "View Snippets",
    },
    {
      id: "chat",
      title: "Test Chat Agent with Function Calling",
      desc: "Ask the agent to perform actions using tool calls like listing orders or times.",
      done: auditLogs.some((a) => a.via === "chat"),
      href: "/chat",
      cta: "Launch Chat",
    },
    ...(isAdmin
      ? [
          {
            id: "teammate",
            title: "Invite a Teammate",
            desc: "Add team members and assign role-based tool privileges.",
            done: (members?.length ?? 0) >= 2,
            href: "/members",
            cta: "Invite Member",
          },
        ]
      : []),
  ]

  const completedCount = steps.filter((s) => s.done).length
  const allCompleted = completedCount === steps.length

  if (allCompleted && collapsed) {
    return (
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-2xs text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 gap-1 text-[11px]">
              <SparklesIcon className="size-3" />
              Setup Complete
            </Badge>
            <span className="text-muted-foreground font-medium">All platform checklist items verified.</span>
          </div>
          <Button variant="ghost" size="xs" onClick={() => setCollapsed(false)}>
            Review steps
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-6">
      <Card className="shadow-xs border-primary/20 bg-linear-to-b from-card to-muted/20">
        <CardHeader className="pb-3 flex flex-row items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">Getting Started Checklist</CardTitle>
              <Badge variant="secondary" className="font-mono text-xs">
                {completedCount}/{steps.length} completed
              </Badge>
            </div>
            <CardDescription className="text-xs mt-1">
              Follow these live milestones to verify the full MCP Gateway evaluation workflow.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setCollapsed(!collapsed)}
            className="text-muted-foreground"
          >
            {collapsed ? <ChevronDownIcon className="size-4" /> : <ChevronUpIcon className="size-4" />}
          </Button>
        </CardHeader>

        {!collapsed && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 divide-y divide-border/60">
              {steps.map((step, idx) => (
                <div key={step.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 gap-2">
                  <div className="flex items-start gap-2.5">
                    {step.done ? (
                      <CheckCircle2Icon className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <CircleIcon className="size-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`text-xs font-medium ${step.done ? "text-foreground line-through opacity-75" : "text-foreground"}`}>
                        {idx + 1}. {step.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{step.desc}</p>
                    </div>
                  </div>
                  <div className="pl-6 sm:pl-0">
                    <Link
                      href={step.href}
                      className={buttonVariants({
                        size: "xs",
                        variant: step.done ? "outline" : "default",
                      })}
                    >
                      {step.cta}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
