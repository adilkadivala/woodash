"use client"

import { useState } from "react"
import { useServers } from "@/hooks/use-servers"
import { useMe } from "@/hooks/use-me"
import { ServerTable } from "@/components/servers/server-table"
import { ServerDialog } from "@/components/servers/server-dialog"
import { Button } from "@/components/ui/button"
import { PlusIcon, RefreshCwIcon, ServerIcon } from "lucide-react"

export default function ServersPage() {
  const { isAdmin } = useMe()
  const { servers, enableServer, disableServer, refreshServer, deleteServer, refetch } = useServers()
  const [isAddOpen, setIsAddOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ServerIcon className="size-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Upstream MCP Servers</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage external Model Context Protocol server endpoints. Tools from enabled servers are aggregated and routed securely.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5 cursor-pointer text-xs"
          >
            <RefreshCwIcon className="size-3.5" />
            Refresh Status
          </Button>

          {isAdmin && (
            <Button
              size="sm"
              onClick={() => setIsAddOpen(true)}
              className="gap-1.5 cursor-pointer text-xs"
            >
              <PlusIcon className="size-3.5" />
              Add Server
            </Button>
          )}
        </div>
      </div>

      {/* Servers Table */}
      <ServerTable
        servers={servers}
        isAdmin={isAdmin}
        onEnable={enableServer}
        onDisable={disableServer}
        onRefresh={refreshServer}
        onDelete={deleteServer}
        onRefreshList={refetch}
      />

      {/* Add Server Dialog */}
      {isAddOpen && (
        <ServerDialog
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onSuccess={refetch}
        />
      )}
    </div>
  )
}
