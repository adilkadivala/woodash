"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useServers } from "@/hooks/use-servers"
import { useMe } from "@/hooks/use-me"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { ServerStatusBadge } from "@/components/shared/status-badge"
import { RelativeTime } from "@/components/shared/relative-time"
import { JsonViewer } from "@/components/shared/json-viewer"
import { CopyButton } from "@/components/shared/copy-button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ServerDialog } from "@/components/servers/server-dialog"
import {
  ServerIcon,
  RefreshCwIcon,
  WrenchIcon,
  SettingsIcon,
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  KeyIcon,
} from "lucide-react"
import Link from "next/link"
import type { Tool, UpstreamServer } from "@/types/api"

export function ServerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { id } = params as { id: string }

  const { isAdmin } = useMe()
  const { servers, refreshServer, enableServer, disableServer, deleteServer, refetch } = useServers()

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  // Find server from cache or query detail
  const server = servers.find((s) => s.id === id || s.slug === id)

  // Fetch tools specific to this server
  const { data: toolsData, isLoading: isLoadingTools } = useQuery<{ tools: Tool[] }>({
    queryKey: ["server-tools", server?.id],
    queryFn: () => api<{ tools: Tool[] }>(`/servers/${server?.id || id}/tools`),
    enabled: !!server,
  })

  const tools = toolsData?.tools || []

  if (!server) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ServerIcon className="size-10 text-muted-foreground mb-3 opacity-60" />
        <h3 className="text-base font-semibold">Server not found</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          The requested upstream server could not be located or may have been deleted.
        </p>
        <Link href="/servers" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to Servers
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      {/* Breadcrumb Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/servers" className={buttonVariants({ variant: "ghost", size: "icon-xs" })}>
            <ArrowLeftIcon className="size-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">{server.name}</h2>
              <ServerStatusBadge status={server.status} error={server.lastError} />
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              Namespace: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">{server.slug}__*</code> &bull; {server.url}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => refreshServer(server.id)}
              className="gap-1.5 cursor-pointer text-xs"
            >
              <RefreshCwIcon className="size-3" />
              Refresh Upstream
            </Button>
          )}
          {isAdmin && (
            <Button
              size="xs"
              onClick={() => setIsEditOpen(true)}
              className="gap-1.5 cursor-pointer text-xs"
            >
              <SettingsIcon className="size-3" />
              Edit Settings
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tools">Tools ({tools.length})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Connection Details</CardTitle>
                <CardDescription className="text-xs">Live status and transport protocol</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Endpoint URL</span>
                  <span className="font-mono text-foreground">{server.url}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Authentication</span>
                  <span className="font-mono uppercase text-foreground">{server.authType}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Credentials Stored</span>
                  <span>{server.hasCredential ? "AES-256-GCM Encrypted" : "None"}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Last Heartbeat</span>
                  <span className="font-mono"><RelativeTime date={server.lastCheckedAt} /></span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Schema Digest</span>
                  <span className="font-mono text-[11px] truncate max-w-[200px] text-muted-foreground">
                    {server.toolsDigest || "None recorded"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Health & Diagnostics</CardTitle>
                <CardDescription className="text-xs">Circuit breaker and error logs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {server.lastError ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive">
                    <p className="font-semibold text-xs">Last Error Diagnostic</p>
                    <p className="text-[11px] font-mono mt-1">{server.lastError}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
                    <div className="flex items-center gap-1.5 font-semibold text-xs">
                      <CheckCircle2Icon className="size-3.5" />
                      All health checks passing
                    </div>
                    <p className="text-[11px] mt-1 opacity-90">
                      Circuit breaker is closed. Requests are flowing with normal latency.
                    </p>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Circuit Breaker</span>
                  <span className="font-mono text-emerald-500 font-medium">CLOSED (Healthy)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Aggregator Routing</span>
                  <span className="font-mono text-foreground">{server.enabled ? "ACTIVE" : "PAUSED"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Tools */}
        <TabsContent value="tools" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <WrenchIcon className="size-4 text-primary" />
                Discovered Tools from {server.name}
              </CardTitle>
              <CardDescription className="text-xs">
                All tools are namespaced with prefix <code>{server.slug}__</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {tools.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  No tools currently indexed for this server. Try refreshing the server connection.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {tools.map((tool) => (
                    <div key={tool.name} className="rounded-lg border bg-muted/20 p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-bold text-foreground text-xs bg-muted px-2 py-0.5 rounded">
                            {tool.name}
                          </code>
                          <CopyButton text={tool.name} size="icon-xs" variant="ghost" />
                        </div>
                      </div>
                      <p className="text-muted-foreground text-xs">{tool.description || "No description provided."}</p>
                      {tool.inputSchema && (
                        <div className="pt-1">
                          <JsonViewer data={tool.inputSchema} title="Input Schema" collapsed={true} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Settings */}
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Server Configuration</CardTitle>
              <CardDescription className="text-xs">
                Modify connection parameters, headers, or secrets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">Active Status</p>
                  <p className="text-muted-foreground text-[11px]">
                    {server.enabled ? "Server is active and receiving tool queries." : "Server is disabled; tools are isolated."}
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    variant={server.enabled ? "outline" : "default"}
                    size="xs"
                    onClick={() => (server.enabled ? disableServer(server.id) : enableServer(server.id))}
                  >
                    {server.enabled ? "Disable Server" : "Enable Server"}
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Edit Full Parameters</p>
                  <p className="text-muted-foreground text-[11px]">Change URL, name, or authentication headers.</p>
                </div>
                {isAdmin && (
                  <Button variant="outline" size="xs" onClick={() => setIsEditOpen(true)}>
                    Open Config Editor
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Danger Zone */}
        <TabsContent value="danger" className="mt-4">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                <AlertTriangleIcon className="size-4" />
                Danger Zone
              </CardTitle>
              <CardDescription className="text-xs">
                Irreversible actions for this upstream server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Remove Server Registration</p>
                  <p className="text-muted-foreground text-[11px]">
                    Permanently deletes this upstream configuration. Its tools will immediately disappear from chat and external clients.
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="xs"
                    onClick={() => setIsDeleteOpen(true)}
                  >
                    Remove Server
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      {isEditOpen && (
        <ServerDialog
          isOpen={isEditOpen}
          server={server}
          onClose={() => setIsEditOpen(false)}
          onSuccess={refetch}
        />
      )}

      {/* Delete Confirmation */}
      {isDeleteOpen && (
        <ConfirmDialog
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={() => {
            deleteServer(server.id)
            router.push("/servers")
          }}
          title={`Remove Upstream Server '${server.name}'?`}
          description="Its tools will disappear for chat and all MCP clients. Any stored credentials will be deleted."
          confirmText="Remove Server"
        />
      )}
    </div>
  )
}

export default ServerDetailPage
