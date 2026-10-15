import { NextRequest, NextResponse } from "next/server"
import { getGatewayUrl } from "@/lib/gateway"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function proxyMcp(req: NextRequest): Promise<NextResponse> {
  const target = new URL("/mcp", getGatewayUrl())

  const headers = new Headers()
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (lower === "host" || lower === "connection") return
    headers.set(key, value)
  })

  let body: ArrayBuffer | undefined
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer()
  }

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: body?.byteLength ? body : undefined,
    ...(body?.byteLength ? { duplex: "half" as const } : {}),
  })

  const responseHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    responseHeaders.set(key, value)
  })

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export const GET = proxyMcp
export const POST = proxyMcp
export const DELETE = proxyMcp
