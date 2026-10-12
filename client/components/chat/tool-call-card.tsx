"use client"

import { useState } from "react"
import { CheckCircle2Icon, Loader2Icon, AlertCircleIcon, ChevronDownIcon, ChevronRightIcon, WrenchIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export interface ToolCallState {
  id: string
  name: string
  arguments?: string
  status: "running" | "success" | "error"
  durationMs?: number
  result?: string
  errorMessage?: string
}

export function ToolCallCard({ call }: { call: ToolCallState }) {
  const [isOpen, setIsOpen] = useState(false)

  let formattedArgs = call.arguments || ""
  try {
    if (call.arguments) {
      formattedArgs = JSON.stringify(JSON.parse(call.arguments), null, 2)
    }
  } catch {}

  let formattedResult = call.result || ""
  try {
    if (call.result) {
      formattedResult = JSON.stringify(JSON.parse(call.result), null, 2)
    }
  } catch {}

  return (
    <div className="rounded-lg border bg-card shadow-2xs overflow-hidden my-2 max-w-xl text-xs transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 bg-muted/30 hover:bg-muted/50 cursor-pointer text-left transition-colors"
      >
        <div className="flex items-center gap-2">
          {call.status === "running" && (
            <Loader2Icon className="size-3.5 text-primary animate-spin shrink-0" />
          )}
          {call.status === "success" && (
            <CheckCircle2Icon className="size-3.5 text-emerald-500 shrink-0" />
          )}
          {call.status === "error" && (
            <AlertCircleIcon className="size-3.5 text-destructive shrink-0" />
          )}

          <span className="font-mono font-semibold text-foreground">{call.name}</span>

          {call.durationMs !== undefined && (
            <span className="text-[10px] font-mono text-muted-foreground">
              {call.durationMs}ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Badge
            variant="outline"
            className="text-[10px] uppercase font-mono py-0 px-1"
          >
            {call.status}
          </Badge>
          {isOpen ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-3 space-y-2 border-t bg-muted/10 font-mono text-[11px]">
          {formattedArgs && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase font-sans mb-1">Arguments</p>
              <pre className="rounded bg-muted/60 p-2 overflow-x-auto text-foreground whitespace-pre-wrap">
                {formattedArgs}
              </pre>
            </div>
          )}

          {call.result && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase font-sans mb-1">Tool Output</p>
              <pre className="rounded bg-muted/60 p-2 overflow-x-auto text-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                {formattedResult}
              </pre>
            </div>
          )}

          {call.errorMessage && (
            <div className="text-destructive rounded bg-destructive/10 p-2">
              <p className="font-semibold font-sans text-xs">Error Executing Tool</p>
              <p>{call.errorMessage}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
