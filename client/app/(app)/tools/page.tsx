"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useTools } from "@/hooks/use-tools"
import { useServers } from "@/hooks/use-servers"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CopyButton } from "@/components/shared/copy-button"
import { JsonViewer } from "@/components/shared/json-viewer"
import { EmptyState } from "@/components/shared/empty-state"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  WrenchIcon,
  SearchIcon,
  ServerIcon,
  AlertTriangleIcon,
  SparklesIcon,
  LayersIcon,
} from "lucide-react"
import Link from "next/link"

export default function ToolsCatalogPage() {
  const { tools, isLoading } = useTools()
  const { servers } = useServers()

  const [search, setSearch] = useState("")
  const [selectedServer, setSelectedServer] = useState<string>("all")
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcut '/' focuses search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Filter tools
  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      const matchesServer =
        selectedServer === "all" ||
        tool.serverSlug === selectedServer ||
        tool.name.startsWith(`${selectedServer}__`)

      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        tool.name.toLowerCase().includes(q) ||
        (tool.description && tool.description.toLowerCase().includes(q)) ||
        (tool.serverName && tool.serverName.toLowerCase().includes(q))

      return matchesServer && matchesSearch
    })
  }, [tools, search, selectedServer])

  // Unreachable servers warning
  const unreachableServers = servers.filter((s) => s.status === "unreachable")

  // Available server slugs
  const serverSlugs = useMemo(() => {
    const slugs = new Set<string>()
    tools.forEach((t) => {
      if (t.serverSlug) slugs.add(t.serverSlug)
      else if (t.name.includes("__")) slugs.add(t.name.split("__")[0])
    })
    return Array.from(slugs)
  }, [tools])

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <WrenchIcon className="size-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Unified Tools Catalog</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Aggregated tool declarations exposed by active upstream MCP servers. Every tool is uniquely namespaced as <code>slug__tool</code>.
          </p>
        </div>

        <Badge variant="outline" className="self-start sm:self-auto font-mono text-xs gap-1.5 py-1 px-2.5">
          <LayersIcon className="size-3 text-primary" />
          {tools.length} total tools active
        </Badge>
      </div>

      {/* Unreachable Servers Banner */}
      {unreachableServers.length > 0 && (
        <Alert variant="destructive" className="border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300">
          <AlertTriangleIcon className="size-4" />
          <AlertTitle className="font-semibold text-xs">Some Upstream Tools Temporarily Unavailable</AlertTitle>
          <AlertDescription className="text-xs mt-0.5">
            Server(s){" "}
            {unreachableServers.map((s) => (
              <strong key={s.id} className="underline mx-1">
                {s.slug}
              </strong>
            ))}{" "}
            are unreachable. Their tools are hidden from callers to ensure gateway reliability.
          </AlertDescription>
        </Alert>
      )}

      {/* Search & Server Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search tools or descriptions... (Press '/' to focus)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>

        {/* Server filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="xs"
            variant={selectedServer === "all" ? "default" : "outline"}
            onClick={() => setSelectedServer("all")}
            className="text-xs cursor-pointer"
          >
            All Servers ({tools.length})
          </Button>
          {serverSlugs.map((slug) => {
            const count = tools.filter(
              (t) => t.serverSlug === slug || t.name.startsWith(`${slug}__`)
            ).length
            return (
              <Button
                key={slug}
                size="xs"
                variant={selectedServer === slug ? "default" : "outline"}
                onClick={() => setSelectedServer(slug)}
                className="text-xs font-mono cursor-pointer"
              >
                {slug} ({count})
              </Button>
            )
          })}
        </div>
      </div>

      {/* Tool Cards Grid */}
      {filteredTools.length === 0 ? (
        <EmptyState
          icon={WrenchIcon}
          title={tools.length === 0 ? "No tools yet" : "No matching tools found"}
          description={
            tools.length === 0
              ? "Register an upstream MCP server to aggregate tools automatically."
              : `No tools matched your search query "${search}". Try adjusting your keywords or clearing the filter.`
          }
          actionLabel={tools.length === 0 ? "Add First Server" : "Clear Filters"}
          onAction={() => {
            if (tools.length === 0) {
              window.location.href = "/servers"
            } else {
              setSearch("")
              setSelectedServer("all")
            }
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTools.map((tool) => {
            const [serverSlug, toolName] = tool.name.includes("__")
              ? tool.name.split("__")
              : [tool.serverSlug || "upstream", tool.name]

            return (
              <Card key={tool.name} className="shadow-2xs flex flex-col justify-between hover:border-primary/40 transition-colors">
                <CardHeader className="pb-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px] bg-muted/60 text-muted-foreground uppercase">
                          {serverSlug}
                        </Badge>
                        <CardTitle className="text-sm font-bold font-mono tracking-tight text-foreground">
                          {tool.name}
                        </CardTitle>
                      </div>
                    </div>
                    <CopyButton text={tool.name} label="Copy name" size="xs" variant="outline" />
                  </div>
                  <CardDescription className="text-xs text-foreground/80 mt-2 line-clamp-3 leading-relaxed">
                    {tool.description || "No description provided by upstream declaration."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-2">
                  {tool.inputSchema ? (
                    <JsonViewer data={tool.inputSchema} title="Input Parameters Schema" collapsed={true} />
                  ) : (
                    <div className="text-[11px] text-muted-foreground italic">No input parameters required</div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
