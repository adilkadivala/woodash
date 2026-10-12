import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OutcomeBadge } from "@/components/shared/status-badge"
import { RelativeTime } from "@/components/shared/relative-time"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"
import type { AuditRow } from "@/types/api"
import { TerminalIcon, MessageSquareIcon, ArrowRightIcon } from "lucide-react"

export function RecentActivityTable({ logs }: { logs: AuditRow[] }) {
  const displayLogs = logs.slice(0, 8)

  return (
    <div className="px-4 lg:px-6">
      <Card className="shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Live Audit & Activity</CardTitle>
            <CardDescription className="text-xs">
              Recent tool calls processed through the central security executor.
            </CardDescription>
          </div>
          <Link
            href="/audit"
            className={cn(buttonVariants({ variant: "ghost", size: "xs" }), "gap-1 text-xs")}
          >
            View full audit log
            <ArrowRightIcon className="size-3" />
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-[11px]">
                  <TableHead>Time</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Server / Tool</TableHead>
                  <TableHead>Attribution</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                      No tool executions recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayLogs.map((log) => (
                    <TableRow key={log.id} className="text-xs">
                      <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                        <RelativeTime date={log.ts} />
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {log.via === "mcp" ? <TerminalIcon className="size-3" /> : <MessageSquareIcon className="size-3" />}
                          {log.via.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-medium text-foreground">
                          {log.serverSlug ? `${log.serverSlug}__${log.toolName}` : log.toolName || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.user?.email || "API Key Principal"}
                      </TableCell>
                      <TableCell>
                        <OutcomeBadge outcome={log.outcome} code={log.errorCode} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {log.durationMs !== null ? `${log.durationMs}ms` : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
