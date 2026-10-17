import { NextRequest } from "next/server"
import { proxyToGateway } from "@/lib/gateway-proxy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ path: string[] }> }

async function handle(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params
  const search = req.nextUrl.search
  return proxyToGateway(req, `/api/${path.join("/")}${search}`)
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
