"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CopyButton } from "./copy-button"
import { ShieldAlertIcon } from "lucide-react"

export function RevealOnceDialog({
  isOpen,
  onClose,
  plaintextKey,
  keyName,
}: {
  isOpen: boolean
  onClose: () => void
  plaintextKey: string
  keyName: string
}) {
  const [hasAcknowledged, setHasAcknowledged] = useState(false)

  const handleClose = () => {
    setHasAcknowledged(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-500">
            <ShieldAlertIcon className="size-5" />
            <DialogTitle>Save Your API Key</DialogTitle>
          </div>
          <DialogDescription>
            Created key <strong>{keyName}</strong>. This secret will <strong>never be shown again</strong>. Copy and store it securely in your secrets manager.
          </DialogDescription>
        </DialogHeader>

        <div className="my-3 space-y-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2.5 font-mono text-xs select-all">
            <span className="flex-1 truncate tracking-tight text-foreground font-semibold">{plaintextKey}</span>
            <CopyButton text={plaintextKey} size="sm" variant="secondary" label="Copy" />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="acknowledge-key"
              checked={hasAcknowledged}
              onCheckedChange={(checked) => setHasAcknowledged(!!checked)}
            />
            <label
              htmlFor="acknowledge-key"
              className="text-xs text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              I have safely copied and stored this API key
            </label>
          </div>
        </div>

        <DialogFooter className="sm:justify-end">
          <Button
            type="button"
            disabled={!hasAcknowledged}
            onClick={handleClose}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
