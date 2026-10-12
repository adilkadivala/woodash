import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangleIcon, ShieldAlertIcon } from "lucide-react"
import type { UpstreamServer } from "@/types/api"
import Link from "next/link"

export function HealthBanner({ servers }: { servers: UpstreamServer[] }) {
  const unreachableServers = servers.filter((s) => s.status === "unreachable")
  const digestChangedServers = servers.filter((s) => s.toolsDigestChanged)

  if (unreachableServers.length === 0 && digestChangedServers.length === 0) {
    return null
  }

  return (
    <div className="px-4 lg:px-6 space-y-3">
      {unreachableServers.map((server) => (
        <Alert key={server.id} variant="destructive" className="border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300">
          <AlertTriangleIcon className="size-4" />
          <AlertTitle className="font-semibold tracking-tight">Upstream Server Unreachable</AlertTitle>
          <AlertDescription className="text-xs">
            Server <strong>{server.name}</strong> (<code>{server.slug}</code>) is failing health checks: {server.lastError || "Connection refused"}. Its tools are temporarily isolated from callers.{" "}
            <Link href={`/servers`} className="underline font-medium hover:text-foreground">
              Review server health &rarr;
            </Link>
          </AlertDescription>
        </Alert>
      ))}

      {digestChangedServers.map((server) => (
        <Alert key={server.id} className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200">
          <ShieldAlertIcon className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="font-semibold tracking-tight">Tool Digest Drift Warning</AlertTitle>
          <AlertDescription className="text-xs">
            Tool declarations for <strong>{server.name}</strong> changed since registration. Please verify upstream updates to ensure schema integrity and avoid tool poisoning attacks.
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
