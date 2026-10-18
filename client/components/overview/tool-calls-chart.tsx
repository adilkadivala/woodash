"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { api } from "@/lib/api"
import { useMe } from "@/hooks/use-me"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AuditStats = {
  days: number
  total: number
  daily: { date: string; success: number; failed: number }[]
  servers: { slug: string; calls: number; errors: number; errorRate: number; p50Ms: number; p95Ms: number }[]
}

const chartConfig = {
  success: { label: "Succeeded", color: "var(--primary)" },
  failed: { label: "Failed", color: "var(--destructive)" },
} satisfies ChartConfig

const RANGES = ["7", "14", "30"] as const

function formatDay(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

/** Tool calls over time plus per-server error rate and latency, from the audit log. */
export function ToolCallsChart() {
  const { user, isAdmin } = useMe()
  const [days, setDays] = React.useState<string>("14")

  const { data } = useQuery<AuditStats>({
    queryKey: ["audit-stats", days],
    queryFn: () => api<AuditStats>(`/audit/stats?days=${days}`),
    enabled: !!user,
    refetchInterval: 15000,
  })

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Tool calls</CardTitle>
        <CardDescription>
          {isAdmin ? "All users" : "Your calls"} · last {days} days · {data?.total ?? 0} calls
        </CardDescription>
        <CardAction>
          <ToggleGroup
            multiple={false}
            value={[days]}
            onValueChange={(value) => setDays(value[0] ?? "14")}
            variant="outline"
          >
            {RANGES.map((r) => (
              <ToggleGroupItem key={r} value={r} className="px-3">
                {r}d
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 px-2 pt-2 sm:px-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
          <AreaChart data={data?.daily ?? []}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={formatDay}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent labelFormatter={(v) => formatDay(String(v))} indicator="dot" />}
            />
            <Area dataKey="success" type="monotone" fill="var(--color-success)" fillOpacity={0.25} stroke="var(--color-success)" stackId="a" />
            <Area dataKey="failed" type="monotone" fill="var(--color-failed)" fillOpacity={0.35} stroke="var(--color-failed)" stackId="a" />
          </AreaChart>
        </ChartContainer>

        {data && data.servers.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Server</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Error rate</TableHead>
                <TableHead className="text-right">p50</TableHead>
                <TableHead className="text-right">p95</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.servers.map((s) => (
                <TableRow key={s.slug}>
                  <TableCell className="font-mono text-xs">{s.slug}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.calls}</TableCell>
                  <TableCell className={`text-right tabular-nums ${s.errorRate > 0.1 ? "text-destructive" : ""}`}>
                    {(s.errorRate * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.p50Ms} ms</TableCell>
                  <TableCell className="text-right tabular-nums">{s.p95Ms} ms</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
