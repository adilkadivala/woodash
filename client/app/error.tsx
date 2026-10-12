"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangleIcon } from "lucide-react"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <Card className="max-w-md w-full text-center shadow-md p-6">
        <CardHeader className="space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangleIcon className="size-6" />
          </div>
          <CardTitle className="text-xl font-bold">Something went wrong</CardTitle>
          <CardDescription className="text-xs">
            An unexpected error occurred while processing this dashboard view.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => reset()} size="sm" className="w-full">
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
