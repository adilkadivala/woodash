"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ServerStatusBadge } from "@/components/shared/status-badge"
import { RelativeTime } from "@/components/shared/relative-time"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ServerDialog } from "./server-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MoreHorizontalIcon,
  RefreshCwIcon,
  EditIcon,
  Trash2Icon,
  EyeIcon,
  ExternalLinkIcon,
  WrenchIcon,
} from "lucide-react"
import Link from "next/link"
import type { UpstreamServer } from "@/types/api"

export function ServerTable({
  servers,
  isAdmin,
  onEnable,
  onDisable,
  onRefresh,
  onDelete,
  onRefreshList,
}: {
  servers: UpstreamServer[]
  isAdmin: boolean
  onEnable: (id: string) => void
  onDisable: (id: string) => void
  onRefresh: (id: string) => void
  onDelete: (id: string) => void
  onRefreshList: () => void
}) {
  const [editingServer, setEditingServer] = useState<UpstreamServer | null>(null)
  const [deletingServer, setDeletingServer] = useState<UpstreamServer | null>(null)

  const getHostFromUrl = (urlStr: string) => {
    try {
      const u = new URL(urlStr)
      return u.host
    } catch {
      return urlStr
    }
  }

  return (
    <>
      <div className="rounded-lg border bg-card overflow-hidden shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 text-xs">
              <TableHead className="w-[200px]">Server Name</TableHead>
              <TableHead>Namespace</TableHead>
              <TableHead>Host URL</TableHead>
              <TableHead>Health Status</TableHead>
              <TableHead className="text-center">Tools</TableHead>
              <TableHead>Last Heartbeat</TableHead>
              {isAdmin && <TableHead className="text-center">Active</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-xs text-muted-foreground">
                  No upstream MCP servers registered yet.
                </TableCell>
              </TableRow>
            ) : (
              servers.map((server) => {
                return (
                  <TableRow key={server.id} className="text-xs transition-colors">
                    {/* Name */}
                    <TableCell className="font-semibold text-foreground">
                      <Link
                        href={`/servers/${server.id}`}
                        className="hover:underline flex items-center gap-1.5"
                      >
                        {server.name}
                      </Link>
                    </TableCell>

                    {/* Slug */}
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">
                        {server.slug}__*
                      </code>
                    </TableCell>

                    {/* URL */}
                    <TableCell className="font-mono text-muted-foreground">
                      <span className="flex items-center gap-1" title={server.url}>
                        {getHostFromUrl(server.url)}
                        <ExternalLinkIcon className="size-2.5 opacity-50" />
                      </span>
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell>
                      <ServerStatusBadge status={server.status} error={server.lastError} />
                    </TableCell>

                    {/* Tool count */}
                    <TableCell className="text-center font-mono font-medium">
                      <Link
                        href={`/servers/${server.id}`}
                        className="inline-flex items-center gap-1 hover:text-primary"
                      >
                        <WrenchIcon className="size-3 text-muted-foreground" />
                        {server.toolCount ?? "—"}
                      </Link>
                    </TableCell>

                    {/* Last Checked */}
                    <TableCell className="font-mono text-muted-foreground">
                      <RelativeTime date={server.lastCheckedAt} />
                    </TableCell>

                    {/* Active toggle */}
                    {isAdmin && (
                      <TableCell className="text-center">
                        <Switch
                          checked={server.enabled}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              onEnable(server.id)
                            } else {
                              onDisable(server.id)
                            }
                          }}
                        />
                      </TableCell>
                    )}

                    {/* Actions */}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-xs" className="cursor-pointer">
                              <MoreHorizontalIcon className="size-3.5" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="text-xs">
                          <DropdownMenuItem
                            render={
                              <Link href={`/servers/${server.id}`} className="cursor-pointer flex items-center">
                                <EyeIcon className="size-3.5 mr-2" />
                                View Server Details
                              </Link>
                            }
                          />

                          {isAdmin && (
                            <>
                              <DropdownMenuItem
                                onClick={() => onRefresh(server.id)}
                                className="cursor-pointer"
                              >
                                <RefreshCwIcon className="size-3.5 mr-2" />
                                Re-index Tools & Ping
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => setEditingServer(server)}
                                className="cursor-pointer"
                              >
                                <EditIcon className="size-3.5 mr-2" />
                                Edit Configuration
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() => setDeletingServer(server)}
                                className="text-destructive focus:text-destructive cursor-pointer"
                              >
                                <Trash2Icon className="size-3.5 mr-2" />
                                Remove Server
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      {editingServer && (
        <ServerDialog
          isOpen={true}
          server={editingServer}
          onClose={() => setEditingServer(null)}
          onSuccess={onRefreshList}
        />
      )}

      {/* Delete Confirmation */}
      {deletingServer && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setDeletingServer(null)}
          onConfirm={() => {
            onDelete(deletingServer.id)
            setDeletingServer(null)
          }}
          title={`Remove Upstream Server '${deletingServer.name}'?`}
          description="Its tools will immediately disappear for chat and all connected external MCP clients. Any stored credentials will be deleted."
          confirmText="Remove Server"
        />
      )}
    </>
  )
}
