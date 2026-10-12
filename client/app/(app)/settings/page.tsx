"use client"

import { useMe } from "@/hooks/use-me"
import { useTheme } from "next-themes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  SettingsIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  LogOutIcon,
  ShieldCheckIcon,
  KeyIcon,
} from "lucide-react"
import { toast } from "sonner"

export default function SettingsPage() {
  const { user, isAdmin, logout, isLoggingOut } = useMe()
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <SettingsIcon className="size-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight">Account & Preferences</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your personal profile, security credentials, and dashboard appearance.
        </p>
      </div>

      {/* Profile Card */}
      <Card className="shadow-2xs">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">User Profile</CardTitle>
          <CardDescription className="text-xs">
            Identity details managed by the MCP Gateway authentication service.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="prof-name">Full Name</Label>
              <Input id="prof-name" value={user.name} readOnly className="bg-muted/40 font-medium" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prof-email">Email Address</Label>
              <Input id="prof-email" value={user.email} readOnly className="bg-muted/40 font-mono" />
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t">
            <div>
              <p className="font-medium text-foreground">Assigned Role</p>
              <p className="text-[11px] text-muted-foreground">
                Determines tool access privileges and administrative permissions.
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-xs uppercase px-2 py-0.5">
              <ShieldCheckIcon className="size-3 mr-1 text-primary" />
              {user.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Theme Card */}
      <Card className="shadow-2xs">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Appearance & Theme</CardTitle>
          <CardDescription className="text-xs">
            Customize the look and feel of your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("light")}
              className="gap-2 cursor-pointer text-xs"
            >
              <SunIcon className="size-4" />
              Light Mode
            </Button>

            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("dark")}
              className="gap-2 cursor-pointer text-xs"
            >
              <MoonIcon className="size-4" />
              Dark Mode
            </Button>

            <Button
              variant={theme === "system" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("system")}
              className="gap-2 cursor-pointer text-xs"
            >
              <MonitorIcon className="size-4" />
              System Default
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Tip: Press <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">d</kbd> anywhere to quickly toggle between light and dark modes.
          </p>
        </CardContent>
      </Card>

      {/* Session Card */}
      <Card className="shadow-2xs border-muted">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Session Management</CardTitle>
          <CardDescription className="text-xs">
            Sign out of your current session on this browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => logout()}
            disabled={isLoggingOut}
            className="gap-1.5 cursor-pointer text-xs"
          >
            <LogOutIcon className="size-3.5" />
            Sign Out of Gateway
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
