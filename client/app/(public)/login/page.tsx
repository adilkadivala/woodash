"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LayersIcon, LockIcon, MailIcon, Loader2Icon, AlertCircleIcon } from "lucide-react"
import { api } from "@/lib/api"
import { toast } from "sonner"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next") || "/"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      })

      toast.success("Signed in successfully")
      const safeRedirect = nextUrl.startsWith("/") && !nextUrl.startsWith("//") ? nextUrl : "/"
      router.push(safeRedirect)
      router.refresh()
    } catch (err: any) {
      if (err.code === "ACCOUNT_DISABLED") {
        setErrorMessage("Your account is disabled. Contact an administrator.")
      } else {
        setErrorMessage("Invalid email or password.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-lg border-primary/20 bg-card">
      <form onSubmit={handleLogin}>
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LayersIcon className="size-5" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">MCP Gateway Sign In</CardTitle>
          <CardDescription className="text-xs">
            Enter your platform credentials to access the central tool dashboard.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-xs">
          {errorMessage && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertCircleIcon className="size-3.5" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="login-email">Email address</Label>
            <div className="relative">
              <MailIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                id="login-email"
                type="email"
                placeholder="admin@gateway.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-8 text-xs h-9"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-password">Password</Label>
            </div>
            <div className="relative">
              <LockIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Membership is invite-only &bull; Contact admin for access
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Suspense fallback={<div className="text-xs text-muted-foreground">Loading login...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
