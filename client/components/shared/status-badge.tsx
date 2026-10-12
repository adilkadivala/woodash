import { Badge } from "@/components/ui/badge"
import { CheckCircle2Icon, AlertCircleIcon, XCircleIcon, ClockIcon, ShieldAlertIcon } from "lucide-react"
import type { Outcome, ServerStatus } from "@/types/api"
import { cn } from "@/lib/utils"

export function ServerStatusBadge({
  status,
  error,
  className,
}: {
  status: ServerStatus
  error?: string | null
  className?: string
}) {
  if (status === "connected") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1.5 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400 font-medium",
          className
        )}
      >
        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Connected
      </Badge>
    )
  }

  if (status === "unreachable") {
    return (
      <Badge
        variant="outline"
        title={error || "Upstream unreachable"}
        className={cn(
          "gap-1.5 border-rose-500/20 bg-rose-500/10 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-400 font-medium",
          className
        )}
      >
        <XCircleIcon className="size-3" />
        Unreachable
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 border-muted-foreground/20 bg-muted text-muted-foreground font-medium", className)}
    >
      <span className="size-1.5 rounded-full bg-muted-foreground/60" />
      Disabled
    </Badge>
  )
}

export function OutcomeBadge({
  outcome,
  code,
  className,
}: {
  outcome: Outcome
  code?: string | null
  className?: string
}) {
  switch (outcome) {
    case "success":
      return (
        <Badge
          variant="outline"
          className={cn(
            "gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400 font-medium",
            className
          )}
        >
          <CheckCircle2Icon className="size-3" />
          Success
        </Badge>
      )
    case "error":
      return (
        <Badge
          variant="outline"
          className={cn(
            "gap-1 border-rose-500/20 bg-rose-500/10 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-400 font-medium",
            className
          )}
        >
          <XCircleIcon className="size-3" />
          {code || "Error"}
        </Badge>
      )
    case "denied":
      return (
        <Badge
          variant="outline"
          className={cn(
            "gap-1 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400 font-medium",
            className
          )}
        >
          <ShieldAlertIcon className="size-3" />
          Denied
        </Badge>
      )
    case "timeout":
      return (
        <Badge
          variant="outline"
          className={cn(
            "gap-1 border-orange-500/20 bg-orange-500/10 text-orange-600 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-400 font-medium",
            className
          )}
        >
          <ClockIcon className="size-3" />
          Timeout
        </Badge>
      )
  }
}
