"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PlusIcon, Trash2Icon, UsersIcon } from "lucide-react"

import { api } from "@/lib/api"
import { useMe } from "@/hooks/use-me"
import { useMembers } from "@/hooks/use-members"
import type { ApiKey } from "@/types/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RevealOnceDialog } from "@/components/shared/reveal-once-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { RelativeTime } from "@/components/shared/relative-time"

type TeamKey = ApiKey & { user?: { email: string; name: string } }

/** Admin-only: every team member's keys, with issue-for-member and revoke. */
export function TeamKeysCard() {
  const queryClient = useQueryClient()
  const { user } = useMe()
  const { members } = useMembers()

  const [ownerId, setOwnerId] = useState<string>("")
  const [keyName, setKeyName] = useState("")
  const [minted, setMinted] = useState<{ plaintext: string; name: string } | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const { data } = useQuery<{ keys: TeamKey[] }>({
    queryKey: ["keys", "all"],
    queryFn: () => api<{ keys: TeamKey[] }>("/keys?all"),
    enabled: !!user,
  })
  const teamKeys = (data?.keys ?? []).filter((k) => k.userId !== user?.id)

  const issue = useMutation({
    mutationFn: () =>
      api<{ key: ApiKey; plaintext: string }>("/keys", {
        method: "POST",
        body: JSON.stringify({ name: keyName.trim(), userId: ownerId }),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["keys"] })
      setMinted({ plaintext: res.plaintext, name: res.key.name })
      setKeyName("")
    },
    onError: (err: any) => toast.error(err.message || "Failed to issue key"),
  })

  const revoke = useMutation({
    mutationFn: (id: string) => api(`/keys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keys"] })
      toast.success("Key revoked. The member's next MCP call is rejected.")
    },
    onError: (err: any) => toast.error(err.message || "Failed to revoke key"),
  })

  const otherMembers = members.filter((m) => m.id !== user?.id && !m.disabled)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UsersIcon className="size-4" /> Team keys
        </CardTitle>
        <CardDescription>Issue a key on a member&apos;s behalf, or revoke any member&apos;s key.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            if (ownerId && keyName.trim()) issue.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label>Member</Label>
            <Select value={ownerId} onValueChange={(v) => setOwnerId(v ?? "")}>
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Choose a member" />
              </SelectTrigger>
              <SelectContent>
                {otherMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="team-key-name">Key name</Label>
            <Input
              id="team-key-name"
              placeholder="e.g. cursor-laptop"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!ownerId || !keyName.trim() || issue.isPending}>
            <PlusIcon className="size-4" /> Issue key
          </Button>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamKeys.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No member keys yet.
                </TableCell>
              </TableRow>
            )}
            {teamKeys.map((k) => (
              <TableRow key={k.id}>
                <TableCell>{k.user?.email ?? k.userId}</TableCell>
                <TableCell>
                  <span className="font-medium">{k.name}</span>{" "}
                  <span className="font-mono text-xs text-muted-foreground">{k.keyPrefix}…</span>
                </TableCell>
                <TableCell>{k.lastUsedAt ? <RelativeTime date={k.lastUsedAt} /> : "Never"}</TableCell>
                <TableCell>
                  {k.revokedAt ? <Badge variant="outline">Revoked</Badge> : <Badge variant="secondary">Active</Badge>}
                </TableCell>
                <TableCell>
                  {!k.revokedAt && (
                    <Button variant="ghost" size="icon" onClick={() => setRevokingId(k.id)} aria-label="Revoke key">
                      <Trash2Icon className="size-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {minted && (
        <RevealOnceDialog
          isOpen={true}
          plaintextKey={minted.plaintext}
          keyName={minted.name}
          onClose={() => setMinted(null)}
        />
      )}
      {revokingId && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setRevokingId(null)}
          onConfirm={() => {
            revoke.mutate(revokingId)
            setRevokingId(null)
          }}
          title="Revoke member key?"
          description="Any MCP client using this key will be rejected on its next call."
          confirmText="Revoke Key"
        />
      )}
    </Card>
  )
}
