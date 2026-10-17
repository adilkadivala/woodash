"use client"

import { useState } from "react"
import { useStores } from "@/hooks/use-stores"
import { StoreStatusBadge } from "@/components/shared/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { RelativeTime } from "@/components/shared/relative-time"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PlusIcon, RefreshCwIcon, StoreIcon, Trash2Icon, RotateCcwIcon, ExternalLinkIcon } from "lucide-react"
import type { Store } from "@/types/api"

export default function StoresPage() {
  const {
    stores,
    maxStoresPerUser,
    kubernetes,
    createStore,
    isCreating,
    retryStore,
    deleteStore,
    refetch,
  } = useStores()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [deleting, setDeleting] = useState<Store | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await createStore({ name: name.trim(), slug: slug.trim() || undefined })
      setOpen(false)
      setName("")
      setSlug("")
    } catch {
      /* toast in hook */
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <StoreIcon className="size-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">WooCommerce Stores</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Each store is a Helm release in its own namespace (<code>store-&#123;slug&#125;</code>),
            with Woo MCP registered as <code>woo-&#123;slug&#125;__*</code>. Limit {maxStoresPerUser} per user.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 cursor-pointer text-xs">
            <RefreshCwIcon className="size-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5 cursor-pointer text-xs">
            <PlusIcon className="size-3.5" />
            New store
          </Button>
        </div>
      </div>

      {!kubernetes && (
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-2xs">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Kubernetes required</CardTitle>
            <CardDescription className="text-xs">
              Multi-store provisioning runs <code>helm upgrade --install</code> into Kind/k3s.
              Docker Compose keeps the single demo store only. Use <code>./scripts/kind-up.sh</code>.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card className="shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Provisioned stores</CardTitle>
          <CardDescription className="text-xs">
            Failed installs can be retried (idempotent Helm). Delete uninstalls the release and the namespace.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-xs">
                  <TableHead>Name</TableHead>
                  <TableHead>MCP slug</TableHead>
                  <TableHead>Namespace</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-xs text-muted-foreground py-8 text-center">
                      No extra stores yet. The platform demo shop remains at the default storefront host.
                    </TableCell>
                  </TableRow>
                ) : (
                  stores.map((store) => (
                    <TableRow key={store.id} className="text-xs">
                      <TableCell>
                        <div className="font-medium">{store.name}</div>
                        <a
                          href={store.storefrontUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          {store.host}
                          <ExternalLinkIcon className="size-3" />
                        </a>
                      </TableCell>
                      <TableCell className="font-mono">{store.mcpSlug ?? `woo-${store.slug}`}</TableCell>
                      <TableCell className="font-mono">{store.namespace}</TableCell>
                      <TableCell>
                        <StoreStatusBadge status={store.status} error={store.lastError} />
                        {store.lastError && (
                          <p className="mt-1 max-w-xs truncate text-[10px] text-muted-foreground" title={store.lastError}>
                            {store.lastError}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <RelativeTime date={store.createdAt} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {store.status === "failed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs cursor-pointer"
                              onClick={() => retryStore(store.id)}
                            >
                              <RotateCcwIcon className="size-3" />
                              Retry
                            </Button>
                          )}
                          {store.status !== "deleting" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs cursor-pointer text-rose-600"
                              onClick={() => setDeleting(store)}
                            >
                              <Trash2Icon className="size-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Provision a store</DialogTitle>
              <DialogDescription>
                Helm installs WordPress, WooCommerce, MariaDB, and a ClusterIP Woo MCP in{" "}
                <code>store-&#123;slug&#125;</code>.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="store-name">Name</Label>
                <Input
                  id="store-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Apparel"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="store-slug">Slug (optional)</Label>
                <Input
                  id="store-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="acme"
                  pattern="[a-z][a-z0-9-]{0,19}"
                />
                <p className="text-[11px] text-muted-foreground">
                  Host will be <code>{(slug || "slug").toLowerCase()}.localtest.me</code>
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isCreating} className="cursor-pointer">
                {isCreating ? "Starting…" : "Create store"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void deleteStore(deleting.id)
          setDeleting(null)
        }}
        title="Delete store?"
        description={`This uninstalls Helm release store-${deleting?.slug ?? ""} and deletes namespace ${deleting?.namespace ?? ""}. Woo tools for this store disappear from the gateway.`}
        confirmText="Delete store"
      />
    </div>
  )
}
