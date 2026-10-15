import { NextRequest, NextResponse } from "next/server"
import { getGatewayUrl } from "@/lib/gateway"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function proxy(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const gateway = getGatewayUrl()
  const path = pathSegments.join("/")
  const target = new URL(`/api/${path}${req.nextUrl.search}`, gateway)

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

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: body?.byteLength ? body : undefined,
      // Required when sending a body in Node 18+ fetch
      ...(body?.byteLength ? { duplex: "half" as const } : {}),
    })
  } catch (err) {
    console.error("[api proxy] gateway unreachable:", target.toString(), err)
    return NextResponse.json(
      {
        error: {
          code: "GATEWAY_UNREACHABLE",
          message: `Cannot reach gateway at ${gateway}. Start the server (cd server && bun run dev).`,
        },
      },
      { status: 502 }
    )
  }

  const responseHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") return
    responseHeaders.set(key, value)
  })

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

type RouteCtx = { params: Promise<{ path: string[] }> }

async function handle(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params
  return proxy(req, path)
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
