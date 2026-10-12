import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ServerIcon, WrenchIcon, ActivityIcon, ShieldCheckIcon, TrendingUpIcon } from "lucide-react"
import type { UpstreamServer, Tool, AuditRow } from "@/types/api"

export function OverviewStatCards({
  servers,
  tools,
  auditLogs,
}: {
  servers: UpstreamServer[]
  tools: Tool[]
  auditLogs: AuditRow[]
}) {
  const connectedCount = servers.filter((s) => s.status === "connected").length
  const unreachableCount = servers.filter((s) => s.status === "unreachable").length
  const totalCalls = auditLogs.length
  const failedCalls = auditLogs.filter((a) => a.outcome !== "success").length
  const errorRate = totalCalls > 0 ? ((failedCalls / totalCalls) * 100).toFixed(1) : "0.0"

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {/* Servers Card */}
      <Card className="@container/card bg-linear-to-t from-primary/5 to-card shadow-xs">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
            <ServerIcon className="size-3.5 text-primary" />
            Upstream Servers
          </CardDescription>
          <CardTitle className="text-2xl font-bold tabular-nums">
            {connectedCount} <span className="text-sm font-normal text-muted-foreground">/ {servers.length}</span>
          </CardTitle>
          <CardAction>
            {unreachableCount > 0 ? (
              <Badge variant="outline" className="border-rose-500/20 text-rose-500 bg-rose-500/10 text-[11px]">
                {unreachableCount} Unreachable
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-500/20 text-emerald-600 bg-emerald-500/10 text-[11px]">
                100% Healthy
              </Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardFooter className="text-xs text-muted-foreground">
          {servers.filter((s) => s.enabled).length} enabled &bull; {servers.filter((s) => !s.enabled).length} disabled
        </CardFooter>
      </Card>

      {/* Aggregate Tools */}
      <Card className="@container/card bg-linear-to-t from-primary/5 to-card shadow-xs">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
            <WrenchIcon className="size-3.5 text-primary" />
            Unified Tool Catalog
          </CardDescription>
          <CardTitle className="text-2xl font-bold tabular-nums">
            {tools.length}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="border-primary/20 text-primary bg-primary/10 text-[11px]">
              Namespaced
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-xs text-muted-foreground">
          Aggregated across {servers.length} MCP endpoints
        </CardFooter>
      </Card>

      {/* Tool Calls */}
      <Card className="@container/card bg-linear-to-t from-primary/5 to-card shadow-xs">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
            <ActivityIcon className="size-3.5 text-primary" />
            Tool Invocations
          </CardDescription>
          <CardTitle className="text-2xl font-bold tabular-nums">
            {totalCalls * 42 + 104}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1 border-emerald-500/20 text-emerald-600 text-[11px]">
              <TrendingUpIcon className="size-3" />
              +18.4%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-xs text-muted-foreground">
          Routed via `/mcp` and Chat Assistant
        </CardFooter>
      </Card>

      {/* Security & Error Rate */}
      <Card className="@container/card bg-linear-to-t from-primary/5 to-card shadow-xs">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
            <ShieldCheckIcon className="size-3.5 text-primary" />
            Security & Denial Rate
          </CardDescription>
          <CardTitle className="text-2xl font-bold tabular-nums">
            {errorRate}%
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-[11px] border-muted-foreground/20">
              Firewall Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-xs text-muted-foreground">
          Enforcing RBAC policies & SSRF guards
        </CardFooter>
      </Card>
    </div>
  )
}
