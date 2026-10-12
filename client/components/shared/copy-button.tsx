"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckIcon, CopyIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function CopyButton({
  text,
  className,
  label,
  variant = "outline",
  size = "icon-xs",
  ...props
}: {
  text: string
  label?: string
} & React.ComponentProps<typeof Button>) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={cn("cursor-pointer", className)}
      onClick={onCopy}
      type="button"
      {...props}
    >
      {copied ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
      {label && <span className="ml-1.5">{copied ? "Copied" : label}</span>}
    </Button>
  )
}
