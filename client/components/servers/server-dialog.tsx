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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { Loader2Icon, CheckCircle2Icon, AlertCircleIcon, PlayIcon } from "lucide-react"
import type { UpstreamServer } from "@/types/api"

export function ServerDialog({
  isOpen,
  onClose,
  server,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  server?: UpstreamServer | null
  onSuccess: () => void
}) {
  const isEditing = !!server

  const [name, setName] = useState(server?.name || "")
  const [slug, setSlug] = useState(server?.slug || "")
  const [url, setUrl] = useState(server?.url || "")
  const [authType, setAuthType] = useState<"none" | "bearer" | "header">(server?.authType || "none")
  const [authHeaderName, setAuthHeaderName] = useState(server?.authHeaderName || "")
  const [credential, setCredential] = useState("")
  const [enabled, setEnabled] = useState(server?.enabled ?? true)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    tested: boolean
    connected?: boolean
    tools?: Array<{ name: string; description?: string }>
    error?: string
  } | null>(null)

  const [slugError, setSlugError] = useState("")
  const [urlError, setUrlError] = useState("")

  const handleNameChange = (val: string) => {
    setName(val)
    if (!isEditing && !slug) {
      // Auto-suggest slug
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/--+/g, "-")
        .slice(0, 31)
      setSlug(generated)
    }
  }

  const handleSlugChange = (val: string) => {
    const sanitized = val.toLowerCase().replace(/[^a-z0-9-]/g, "")
    setSlug(sanitized)
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(sanitized)) {
      setSlugError("Slug must begin with a letter and contain only a-z, 0-9, and hyphens (max 32 chars).")
    } else {
      setSlugError("")
    }
  }

  const handleTestConnection = async () => {
    if (!url) {
      setUrlError("URL is required to test connection")
      return
    }
    setUrlError("")
    setIsTesting(true)
    setTestResult(null)

    try {
      const res = await api<{ connected: boolean; tools?: any[]; error?: string }>("/servers/test", {
        method: "POST",
        body: JSON.stringify({
          url,
          authType,
          authHeaderName: authType === "header" ? authHeaderName : undefined,
          credential: credential || undefined,
        }),
      })

      setTestResult({
        tested: true,
        connected: res.connected,
        tools: res.tools,
        error: res.error,
      })

      if (res.connected) {
        toast.success(`Successfully connected! Found ${res.tools?.length || 0} tools.`)
      } else {
        toast.warning(res.error || "Connection test failed")
      }
    } catch (err: any) {
      setTestResult({
        tested: true,
        connected: false,
        error: err.message || "Failed to reach server",
      })
      toast.error(err.message || "Connection test failed")
    } finally {
      setIsTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSlugError("")
    setUrlError("")

    if (!name.trim()) return
    if (!isEditing && !/^[a-z][a-z0-9-]{0,31}$/.test(slug)) {
      setSlugError("Valid slug is required")
      return
    }
    if (!url.trim()) {
      setUrlError("Valid URL is required")
      return
    }

    setIsSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        name,
        url,
        authType,
        authHeaderName: authType === "header" ? authHeaderName : null,
        enabled,
      }

      if (!isEditing) {
        payload.slug = slug
      }
      if (credential) {
        payload.credential = credential
      }

      if (isEditing) {
        await api(`/servers/${server.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        toast.success("Server updated successfully")
      } else {
        await api("/servers", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        toast.success(`Registered server '${slug}' successfully`)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      if (err.code === "SLUG_TAKEN") {
        setSlugError("This slug is already taken by another registered server.")
      } else if (err.code === "URL_NOT_ALLOWED" || err.message?.includes("SSRF")) {
        setUrlError(err.message || "URL blocked by SSRF security policy.")
      } else {
        toast.error(err.message || "Failed to save server")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Upstream Server" : "Register MCP Server"}</DialogTitle>
            <DialogDescription className="text-xs">
              Connect a Streamable HTTP Model Context Protocol server. Tools will be automatically indexed into the gateway.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 text-xs">
            {/* Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="server-name">Display Name</Label>
              <Input
                id="server-name"
                placeholder="e.g. WooCommerce Production Store"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </div>

            {/* Slug */}
            <div className="grid gap-1.5">
              <Label htmlFor="server-slug">
                Namespace Slug{" "}
                <span className="text-muted-foreground font-normal">
                  (tools will be named <code>slug__tool</code>)
                </span>
              </Label>
              <Input
                id="server-slug"
                placeholder="e.g. woo"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                disabled={isEditing}
                required
              />
              {slugError && <p className="text-[11px] text-destructive">{slugError}</p>}
            </div>

            {/* URL */}
            <div className="grid gap-1.5">
              <Label htmlFor="server-url">Endpoint URL</Label>
              <Input
                id="server-url"
                placeholder="https://shop.example.com/wp-json/mcp"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setUrlError("")
                }}
                required
              />
              {urlError && <p className="text-[11px] text-destructive">{urlError}</p>}
            </div>

            {/* Auth Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="auth-type">Authentication Type</Label>
                <Select value={authType} onValueChange={(val) => val && setAuthType(val as "none" | "bearer" | "header")}>
                  <SelectTrigger id="auth-type">
                    <SelectValue placeholder="Select Auth" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Public/mTLS)</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="header">Custom HTTP Header</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {authType === "header" && (
                <div className="grid gap-1.5">
                  <Label htmlFor="header-name">Header Name</Label>
                  <Input
                    id="header-name"
                    placeholder="X-Custom-Auth"
                    value={authHeaderName}
                    onChange={(e) => setAuthHeaderName(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            {/* Credential */}
            {authType !== "none" && (
              <div className="grid gap-1.5">
                <Label htmlFor="server-credential">
                  Secret Credential{" "}
                  <span className="text-muted-foreground font-normal">
                    {isEditing ? "(stored AES-GCM encrypted, leave blank to keep)" : "(write-only)"}
                  </span>
                </Label>
                <Input
                  id="server-credential"
                  type="password"
                  autoComplete="new-password"
                  placeholder={isEditing && server?.hasCredential ? "•••••••• (stored securely)" : "Enter token or API key"}
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                />
              </div>
            )}

            {/* Enabled Switch */}
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
              <div className="space-y-0.5">
                <Label htmlFor="server-enabled" className="text-xs font-medium cursor-pointer">
                  Enable Server Immediately
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  When enabled, its tools are published to external MCP clients and the Chat Agent.
                </p>
              </div>
              <Switch id="server-enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {/* Test Connection Button & Result */}
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-foreground">Pre-flight Connection Test</h4>
                  <p className="text-[11px] text-muted-foreground">Test connectivity and preview tools before saving.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleTestConnection}
                  disabled={isTesting || !url}
                  className="gap-1 cursor-pointer"
                >
                  {isTesting ? <Loader2Icon className="size-3 animate-spin" /> : <PlayIcon className="size-3" />}
                  Test Connection
                </Button>
              </div>

              {testResult && (
                <div className="pt-2 border-t text-xs">
                  {testResult.connected ? (
                    <div className="space-y-1.5 text-emerald-600 dark:text-emerald-400">
                      <div className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2Icon className="size-3.5" />
                        Connected! Discovered {testResult.tools?.length || 0} tools.
                      </div>
                      {testResult.tools && testResult.tools.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {testResult.tools.map((t) => (
                            <span key={t.name} className="font-mono text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              {slug ? `${slug}__${t.name}` : t.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-destructive font-medium">
                      <AlertCircleIcon className="size-3.5" />
                      {testResult.error || "Connection test failed"}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Register Server"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
