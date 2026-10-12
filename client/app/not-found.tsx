import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LayersIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <Card className="max-w-md w-full text-center shadow-md p-6">
        <CardHeader className="space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LayersIcon className="size-6" />
          </div>
          <CardTitle className="text-xl font-bold">Page Not Found</CardTitle>
          <CardDescription className="text-xs">
            The page or gateway resource you are looking for does not exist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/" className={cn(buttonVariants({ size: "sm" }), "w-full")}>
            Back to Dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
