import { NextRequest } from "next/server"
import { proxyToGateway } from "@/lib/gateway-proxy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function proxyMcp(req: NextRequest) {
  return proxyToGateway(req, `/mcp${req.nextUrl.search}`)
}

export const GET = proxyMcp
export const POST = proxyMcp
export const DELETE = proxyMcp
