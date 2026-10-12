"use client"

import { useState } from "react"
import { useAudit } from "@/hooks/use-audit"
import { useServers } from "@/hooks/use-servers"
import { useTools } from "@/hooks/use-tools"
import { useMe } from "@/hooks/use-me"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { OutcomeBadge } from "@/components/shared/status-badge"
import { RelativeTime } from "@/components/shared/relative-time"
import { CopyButton } from "@/components/shared/copy-button"
import {
  ScrollTextIcon,
  RefreshCwIcon,
  TerminalIcon,
  MessageSquareIcon,
  RadioIcon,
  FilterIcon,
} from "lucide-react"
import type { AuditRow } from "@/types/api"

export default function AuditPage() {
  const { isAdmin } = useMe()
  const { servers } = useServers()
  const { tools } = useTools()

  const [serverFilter, setServerFilter] = useState("all")
  const [toolFilter, setToolFilter] = useState("all")
  const [outcomeFilter, setOutcomeFilter] = useState("all")
  const [autoRefresh, setAutoRefresh] = useState(false)

  const [selectedRow, setSelectedRow] = useState<AuditRow | null>(null)

  const { logs, nextCursor, isLoading, refetch, setCursor } = useAudit(
    {
      server: serverFilter !== "all" ? serverFilter : undefined,
      tool: toolFilter !== "all" ? toolFilter : undefined,
      outcome: outcomeFilter !== "all" ? outcomeFilter : undefined,
    },
    autoRefresh
  )

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ScrollTextIcon className="size-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Audit & Security Log</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tamper-evident audit trail of every tool execution, access denial, and timeout across all channels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center space-x-2 border rounded-lg px-2.5 py-1 bg-muted/20">
            <RadioIcon className={`size-3.5 ${autoRefresh ? "text-emerald-500 animate-pulse" : "text-muted-foreground"}`} />
            <Label htmlFor="auto-refresh" className="text-xs cursor-pointer">
              Live Stream (5s)
            </Label>
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5 cursor-pointer text-xs"
          >
            <RefreshCwIcon className="size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters row */}
      <Card className="shadow-2xs">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <FilterIcon className="size-3.5" />
              <span>Filters:</span>
            </div>

            {/* Server Filter */}
            <div className="w-40">
              <Select value={serverFilter} onValueChange={(val) => setServerFilter(val || "all")}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Servers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Servers</SelectItem>
                  {servers.map((s) => (
                    <SelectItem key={s.slug} value={s.slug}>
                      {s.slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tool Filter */}
            <div className="w-48">
              <Select value={toolFilter} onValueChange={(val) => setToolFilter(val || "all")}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Tools" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tools</SelectItem>
                  {tools.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Outcome Filter */}
            <div className="w-36">
              <Select value={outcomeFilter} onValueChange={(val) => setOutcomeFilter(val || "all")}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Outcomes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="denied">Policy Denied</SelectItem>
                  <SelectItem value="timeout">Timeout</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(serverFilter !== "all" || toolFilter !== "all" || outcomeFilter !== "all") && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setServerFilter("all")
                  setToolFilter("all")
                  setOutcomeFilter("all")
                }}
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Reset filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <div className="rounded-lg border bg-card overflow-hidden shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 text-xs">
              <TableHead className="w-[140px]">Timestamp</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Server / Tool</TableHead>
              <TableHead>Principal / User</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead className="text-right">Execution Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                  No audit logs matching current filter.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow
                  key={log.id}
                  onClick={() => setSelectedRow(log)}
                  className="text-xs cursor-pointer hover:bg-muted/50 transition-colors"
                >
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

      {/* Pagination Load More */}
      {nextCursor && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(nextCursor)}
            className="cursor-pointer text-xs"
          >
            Load Older Entries
          </Button>
        </div>
      )}

      {/* Detail Inspection Sheet */}
      <Sheet open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {selectedRow && (
            <div className="space-y-4 text-xs">
              <SheetHeader>
                <SheetTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Audit Entry #{selectedRow.id}</span>
                  <OutcomeBadge outcome={selectedRow.outcome} code={selectedRow.errorCode} />
                </SheetTitle>
                <SheetDescription className="text-xs font-mono">
                  {new Date(selectedRow.ts).toUTCString()}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-3 pt-3">
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Tool Invoked</span>
                  <span className="font-mono font-semibold text-foreground">
                    {selectedRow.serverSlug ? `${selectedRow.serverSlug}__${selectedRow.toolName}` : selectedRow.toolName}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Channel</span>
                  <span className="font-mono uppercase text-foreground">{selectedRow.via}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Principal User</span>
                  <span className="text-foreground">{selectedRow.user?.email || "API Key"}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Execution Latency</span>
                  <span className="font-mono text-foreground">{selectedRow.durationMs ?? "—"}ms</span>
                </div>

                <div className="flex justify-between py-1.5 border-b items-center">
                  <span className="text-muted-foreground">Arguments Hash (SHA-256)</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">
                      {selectedRow.argsHash || "None"}
                    </span>
                    {selectedRow.argsHash && <CopyButton text={selectedRow.argsHash} size="icon-xs" variant="ghost" />}
                  </div>
                </div>

                {selectedRow.errorMessage && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 space-y-1">
                    <p className="font-semibold text-destructive">Error Diagnostic</p>
                    <p className="font-mono text-[11px] text-destructive/90 whitespace-pre-wrap">
                      {selectedRow.errorMessage}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
