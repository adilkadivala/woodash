"use client"

import { useState, useEffect } from "react"
import { useKeys } from "@/hooks/use-keys"
import { useMe } from "@/hooks/use-me"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RevealOnceDialog } from "@/components/shared/reveal-once-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CopyButton } from "@/components/shared/copy-button"
import { RelativeTime } from "@/components/shared/relative-time"
import {
  KeyRoundIcon,
  PlusIcon,
  Trash2Icon,
  TerminalIcon,
  ShieldAlertIcon,
  CheckCircle2Icon,
  CodeIcon,
} from "lucide-react"

export default function ApiKeysPage() {
  const { keys, createKey, isCreating, revokeKey, isRevoking } = useKeys()
  const { isAdmin } = useMe()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")

  // State for reveal-once modal (cleared immediately upon close)
  const [mintedKey, setMintedKey] = useState<{ plaintext: string; name: string } | null>(null)
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null)

  const [host, setHost] = useState("localhost:4000")

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHost(window.location.host)
    }
  }, [])

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return

    try {
      const res = await createKey(newKeyName.trim())
      setIsCreateOpen(false)
      setNewKeyName("")
      // Open reveal-once modal with plaintext key
      setMintedKey({
        plaintext: res.plaintext,
        name: res.key.name,
      })
    } catch {}
  }

  const claudeDesktopSnippet = `{
  "mcpServers": {
    "gateway": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://${host}/mcp",
        "--header",
        "Authorization: Bearer <YOUR_KEY>"
      ]
    }
  }
}`

  const cursorSnippet = `{
  "mcpServers": {
    "gateway": {
      "url": "http://${host}/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_KEY>"
      }
    }
  }
}`

  const curlSnippet = `curl -s http://${host}/mcp \\
  -H 'Authorization: Bearer <YOUR_KEY>' \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <KeyRoundIcon className="size-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">API Keys & Client Config</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Mint Bearer tokens to connect IDEs, AI clients, or scripts to the single <code>/mcp</code> endpoint.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="gap-1.5 cursor-pointer text-xs"
        >
          <PlusIcon className="size-3.5" />
          Create API Key
        </Button>
      </div>

      {/* Keys Table */}
      <Card className="shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Active API Credentials</CardTitle>
          <CardDescription className="text-xs">
            Keys are hashed using SHA-256 at rest. Only the prefix is displayed.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-xs">
                  <TableHead>Key Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Invocations</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                      No API keys minted yet. Create one to connect Claude Desktop or Cursor.
                    </TableCell>
                  </TableRow>
                ) : (
                  keys.map((k) => {
                    const isRevoked = !!k.revokedAt
                    return (
                      <TableRow key={k.id} className="text-xs">
                        <TableCell className="font-semibold text-foreground">{k.name}</TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground font-medium">
                            {k.keyPrefix}&hellip;
                          </code>
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          <RelativeTime date={k.createdAt} />
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          <RelativeTime date={k.lastUsedAt} />
                        </TableCell>
                        <TableCell>
                          {isRevoked ? (
                            <Badge variant="outline" className="border-muted-foreground/20 text-muted-foreground text-[10px]">
                              Revoked
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!isRevoked && (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => setRevokingKeyId(k.id)}
                              className="text-destructive hover:text-destructive cursor-pointer gap-1"
                            >
                              <Trash2Icon className="size-3" />
                              Revoke
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Connect a Client Panel */}
      <Card className="shadow-2xs">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TerminalIcon className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Connect External MCP Clients</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Copy ready-made configuration snippets into your local toolchain to consume all aggregated tools.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="claude" className="w-full text-xs">
            <TabsList className="grid w-full grid-cols-3 max-w-sm mb-3">
              <TabsTrigger value="claude">Claude Desktop</TabsTrigger>
              <TabsTrigger value="cursor">Cursor IDE</TabsTrigger>
              <TabsTrigger value="curl">cURL Smoke Test</TabsTrigger>
            </TabsList>

            {/* Claude Desktop */}
            <TabsContent value="claude" className="space-y-2">
              <p className="text-muted-foreground text-[11px]">
                Add to your <code>claude_desktop_config.json</code> using the <code>mcp-remote</code> bridge:
              </p>
              <div className="relative rounded-lg border bg-muted/40 p-3 font-mono text-[11px] overflow-x-auto">
                <CopyButton text={claudeDesktopSnippet} className="absolute right-2 top-2" />
                <pre>{claudeDesktopSnippet}</pre>
              </div>
            </TabsContent>

            {/* Cursor */}
            <TabsContent value="cursor" className="space-y-2">
              <p className="text-muted-foreground text-[11px]">
                Add to your Cursor MCP settings under <code>Settings &rarr; Features &rarr; MCP</code>:
              </p>
              <div className="relative rounded-lg border bg-muted/40 p-3 font-mono text-[11px] overflow-x-auto">
                <CopyButton text={cursorSnippet} className="absolute right-2 top-2" />
                <pre>{cursorSnippet}</pre>
              </div>
            </TabsContent>

            {/* cURL */}
            <TabsContent value="curl" className="space-y-2">
              <p className="text-muted-foreground text-[11px]">
                Test JSON-RPC connectivity and tool aggregation from terminal:
              </p>
              <div className="relative rounded-lg border bg-muted/40 p-3 font-mono text-[11px] overflow-x-auto">
                <CopyButton text={curlSnippet} className="absolute right-2 top-2" />
                <pre>{curlSnippet}</pre>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Mint Key Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateKey}>
            <DialogHeader>
              <DialogTitle>Create Gateway API Key</DialogTitle>
              <DialogDescription className="text-xs">
                Enter a descriptive label (e.g. &ldquo;Cursor Workstation&rdquo; or &ldquo;Claude Team Agent&rdquo;).
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="key-name" className="text-xs">Key Label</Label>
              <Input
                id="key-name"
                placeholder="e.g. Cursor Pro Machine"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="mt-1.5 text-xs"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || !newKeyName.trim()}>
                Generate Key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reveal Once Modal */}
      {mintedKey && (
        <RevealOnceDialog
          isOpen={true}
          plaintextKey={mintedKey.plaintext}
          keyName={mintedKey.name}
          onClose={() => setMintedKey(null)}
        />
      )}

      {/* Revoke Confirmation */}
      {revokingKeyId && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setRevokingKeyId(null)}
          onConfirm={() => {
            revokeKey(revokingKeyId)
            setRevokingKeyId(null)
          }}
          title="Revoke API Key?"
          description="Any external MCP clients or scripts using this key will immediately receive 401 Unauthorized errors."
          confirmText="Revoke Key"
        />
      )}
    </div>
  )
}
