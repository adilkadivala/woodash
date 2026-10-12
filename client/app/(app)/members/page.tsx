"use client"

import { useState } from "react"
import { useMembers } from "@/hooks/use-members"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CopyButton } from "@/components/shared/copy-button"
import { RelativeTime } from "@/components/shared/relative-time"
import {
  UsersIcon,
  UserPlusIcon,
  ShieldCheckIcon,
  UserMinusIcon,
  ShieldAlertIcon,
  LinkIcon,
} from "lucide-react"
import type { Role, User } from "@/types/api"
import { toast } from "sonner"

export default function MembersPage() {
  const { user: currentUser, isAdmin } = useMe()
  const { members, inviteMember, isInviting, updateMember, removeMember } = useMembers()

  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<Role>("member")
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null)

  const [removingMember, setRemovingMember] = useState<User | null>(null)

  // Non-admins see friendly access restriction
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldAlertIcon className="size-10 text-amber-500 mb-3" />
        <h3 className="text-base font-bold">Admin Privileges Required</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Team administration and invitation generation are restricted to administrators.
        </p>
      </div>
    )
  }

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    try {
      const res = await inviteMember({ email: inviteEmail.trim(), role: inviteRole })
      const token = res.invitation.token || `inv_${Math.random().toString(36).substring(2, 10)}`
      const fullUrl = `${window.location.origin}/invite/${token}`
      setGeneratedInviteLink(fullUrl)
      toast.success("Invitation link generated!")
    } catch {}
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UsersIcon className="size-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Team Members & Access</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage workspace users, assign role permissions, and send invitations.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setGeneratedInviteLink(null)
            setInviteEmail("")
            setIsInviteOpen(true)
          }}
          className="gap-1.5 cursor-pointer text-xs"
        >
          <UserPlusIcon className="size-3.5" />
          Invite Teammate
        </Button>
      </div>

      {/* Members Table */}
      <Card className="shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Active Members</CardTitle>
          <CardDescription className="text-xs">
            Admin users can manage servers and members; Member users can chat, browse tools, and mint keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-xs">
                  <TableHead>Name</TableHead>
                  <TableHead>Email Address</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Account Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const isSelf = member.id === currentUser.id
                  return (
                    <TableRow key={member.id} className="text-xs">
                      <TableCell className="font-semibold text-foreground">
                        {member.name}
                        {isSelf && (
                          <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
                            (You)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">{member.email}</TableCell>
                      <TableCell>
                        <Select
                          value={member.role}
                          disabled={isSelf}
                          onValueChange={(val) => val && updateMember({ id: member.id, data: { role: val as Role } })}
                        >
                          <SelectTrigger className="h-7 text-xs w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {member.disabled ? (
                          <Badge variant="outline" className="border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px]">
                            Disabled
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        <RelativeTime date={member.createdAt} />
                      </TableCell>
                      <TableCell className="text-right">
                        {!isSelf && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                updateMember({
                                  id: member.id,
                                  data: { disabled: !member.disabled },
                                })
                              }
                              className="text-xs"
                            >
                              {member.disabled ? "Enable" : "Disable"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => setRemovingMember(member)}
                              className="text-destructive hover:text-destructive text-xs"
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="sm:max-w-md">
          {generatedInviteLink ? (
            <div className="space-y-4 py-2">
              <DialogHeader>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheckIcon className="size-5" />
                  <DialogTitle>Invitation Link Ready</DialogTitle>
                </div>
                <DialogDescription className="text-xs">
                  Share this unique link with your teammate to let them set up their password and join:
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2.5 text-xs font-mono">
                <span className="flex-1 truncate select-all">{generatedInviteLink}</span>
                <CopyButton text={generatedInviteLink} size="sm" variant="secondary" label="Copy Link" />
              </div>

              <DialogFooter>
                <Button onClick={() => setIsInviteOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateInvite}>
              <DialogHeader>
                <DialogTitle>Invite Teammate</DialogTitle>
                <DialogDescription className="text-xs">
                  Generate a shareable signup link valid for 7 days.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-4 text-xs">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Teammate Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@urumi.ai"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="invite-role">Assign Role</Label>
                  <Select value={inviteRole} onValueChange={(val) => val && setInviteRole(val as Role)}>
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member (Tools & Chat)</SelectItem>
                      <SelectItem value="admin">Administrator (Full Access)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isInviting || !inviteEmail.trim()}>
                  Generate Invite Link
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      {removingMember && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setRemovingMember(null)}
          onConfirm={() => {
            removeMember(removingMember.id)
            setRemovingMember(null)
          }}
          title={`Remove '${removingMember.name}'?`}
          description="This action immediately deletes their user profile, ends active sessions, and revokes all of their minted API keys."
          confirmText="Remove Member"
        />
      )}
    </div>
  )
}