"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LayersIcon, LockIcon, UserIcon, Loader2Icon, AlertCircleIcon, CheckCircle2Icon } from "lucide-react"
import { api } from "@/lib/api"
import { toast } from "sonner"
import Link from "next/link"

export default function AcceptInvitePage() {
  const params = useParams()
  const router = useRouter()
  const { token } = params as { token: string }

  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isInvalidToken, setIsInvalidToken] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.")
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.")
      return
    }

    setIsLoading(true)
    try {
      await api("/auth/accept-invite", {
        method: "POST",
        body: JSON.stringify({
          token,
          name: name.trim(),
          password,
        }),
      })

      toast.success("Account created and signed in!")
      router.push("/")
      router.refresh()
    } catch (err: any) {
      if (err.code === "INVALID_INVITE" || err.code === "INVITE_EXPIRED" || err.code === "INVITE_USED") {
        setIsInvalidToken(true)
      } else {
        setErrorMsg(err.message || "Failed to accept invite.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isInvalidToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-sm shadow-md text-center p-6 space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
            <AlertCircleIcon className="size-6" />
          </div>
          <CardTitle className="text-base font-bold">Invalid or Expired Invite</CardTitle>
          <p className="text-xs text-muted-foreground">
            This invitation link is no longer valid or has already been used. Please ask your workspace administrator for a new invite.
          </p>
          <Link
            href="/login"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-full")}
          >
            Return to Sign In
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm shadow-lg border-primary/20 bg-card">
        <form onSubmit={handleSubmit}>
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <LayersIcon className="size-5" />
            </div>
            <CardTitle className="text-xl font-bold tracking-tight">Accept Gateway Invite</CardTitle>
            <CardDescription className="text-xs">
              Set up your profile name and password to join your team.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3.5 text-xs">
            {errorMsg && (
              <Alert variant="destructive" className="py-2 text-xs">
                <AlertCircleIcon className="size-3.5" />
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="invitee-name">Full Name</Label>
              <div className="relative">
                <UserIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  id="invitee-name"
                  placeholder="e.g. Sarah Connor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-8 text-xs h-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invitee-password">Create Password (min. 8 chars)</Label>
              <div className="relative">
                <LockIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  id="invitee-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-8 text-xs h-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invitee-confirm">Confirm Password</Label>
              <div className="relative">
                <LockIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  id="invitee-confirm"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-8 text-xs h-9"
                  required
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 pt-2">
            <Button type="submit" disabled={isLoading} className="w-full text-xs">
              {isLoading ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin mr-1.5" />
                  Creating account...
                </>
              ) : (
                "Complete Setup & Join"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
