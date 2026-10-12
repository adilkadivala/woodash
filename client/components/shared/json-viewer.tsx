"use client"

import { useState } from "react"
import { CopyButton } from "./copy-button"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function JsonViewer({
  data,
  title = "Schema / JSON",
  collapsed = false,
}: {
  data: unknown
  title?: string
  collapsed?: boolean
}) {
  const [isOpen, setIsOpen] = useState(!collapsed)
  const jsonStr = JSON.stringify(data, null, 2) || "{}"

  return (
    <div className="rounded-lg border bg-muted/30 overflow-hidden text-xs">
      <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {isOpen ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
          <span>{title}</span>
        </button>
        <CopyButton text={jsonStr} size="icon-xs" variant="ghost" />
      </div>
      {isOpen && (
        <pre className="p-3 font-mono text-muted-foreground overflow-x-auto max-h-72 leading-relaxed selection:bg-primary/20">
          <code>{jsonStr}</code>
        </pre>
      )}
    </div>
  )
}
