"use client"

import { useServers } from "@/hooks/use-servers"
import { useTools } from "@/hooks/use-tools"
import { useKeys } from "@/hooks/use-keys"
import { useAudit } from "@/hooks/use-audit"
import { useMembers } from "@/hooks/use-members"
import { useMe } from "@/hooks/use-me"
import { HealthBanner } from "@/components/overview/health-banner"
import { OverviewStatCards } from "@/components/overview/stat-cards"
import { ChecklistCard } from "@/components/overview/checklist-card"
import { RecentActivityTable } from "@/components/overview/recent-activity"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"

export default function OverviewPage() {
  const { user, isAdmin } = useMe()
  const { servers } = useServers()
  const { tools } = useTools()
  const { keys } = useKeys()
  const { logs } = useAudit()
  const { members } = useMembers()

  return (
    <div className="flex flex-col gap-6">
      {/* Dynamic Health Warning if any server is unreachable or digest changed */}
      <HealthBanner servers={servers} />

      {/* KPI Stat Cards */}
      <OverviewStatCards servers={servers} tools={tools} auditLogs={logs} />

      {/* Live Getting-Started Checklist */}
      <ChecklistCard
        isAdmin={isAdmin}
        servers={servers}
        tools={tools}
        keys={keys}
        auditLogs={logs}
        members={members}
      />

      {/* Interactive Tool Invocation Charts */}
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>

      {/* Recent Tool Executions */}
      <RecentActivityTable logs={logs} />
    </div>
  )
}
