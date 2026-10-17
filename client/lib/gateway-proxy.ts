import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import type { IncomingHttpHeaders, OutgoingHttpHeaders } from "node:http"
import { NextRequest, NextResponse } from "next/server"
import { getGatewayUrl } from "@/lib/gateway"

const DROP_REQ = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  // Browser cache validators make Express return 304; NextResponse cannot
  // construct a 304, which was surfaced as GATEWAY_UNREACHABLE.
  "if-none-match",
  "if-modified-since",
  "if-match",
  "if-unmodified-since",
])
const DROP_RES = new Set(["transfer-encoding", "connection", "keep-alive", "etag"])
const NO_BODY_STATUS = new Set([204, 205, 304])

/**
 * Proxy to the gateway with Node's http client.
 * `fetch()` strips Cookie / Set-Cookie (forbidden headers), which 401-loops the dashboard.
 */
export async function proxyToGateway(req: NextRequest, pathWithSearch: string): Promise<NextResponse> {
  const target = new URL(pathWithSearch, `${getGatewayUrl().replace(/\/$/, "")}/`)
  const method = req.method.toUpperCase()
  const body =
    method === "GET" || method === "HEAD" ? undefined : Buffer.from(await req.arrayBuffer())

  const headers: OutgoingHttpHeaders = {}
  req.headers.forEach((value, key) => {
    if (DROP_REQ.has(key.toLowerCase())) return
    headers[key] = value
  })
  const cookie = req.headers.get("cookie")
  if (cookie) headers.cookie = cookie
  if (body?.length) headers["content-length"] = body.length

  try {
    const upstream = await nodeRequest(target, method, headers, body)
    const out = new Headers()
    for (const [key, value] of Object.entries(upstream.headers)) {
      if (!value || DROP_RES.has(key.toLowerCase())) continue
      if (key.toLowerCase() === "set-cookie") {
        const cookies = Array.isArray(value) ? value : [value]
        for (const c of cookies) out.append("set-cookie", c)
        continue
      }
      out.set(key, Array.isArray(value) ? value.join(", ") : value)
    }
    const status = NO_BODY_STATUS.has(upstream.status) ? (upstream.status === 304 ? 200 : upstream.status) : upstream.status
    const bodyOut = status === 204 || status === 205 ? null : new Uint8Array(upstream.body)
    const res = new NextResponse(bodyOut, {
      status,
      headers: out,
    })
    if (isLogoutPath(pathWithSearch)) {
      expireSid(res)
    }
    return res
  } catch (err) {
    console.error("[api proxy] gateway unreachable:", target.toString(), err)
    const res = NextResponse.json(
      {
        error: {
          code: "GATEWAY_UNREACHABLE",
          message: `Cannot reach gateway at ${getGatewayUrl()}. Start the server (cd server && bun run dev).`,
        },
      },
      { status: 502 }
    )
    if (isLogoutPath(pathWithSearch)) expireSid(res)
    return res
  }
}

function isLogoutPath(pathWithSearch: string) {
  return pathWithSearch.split("?")[0] === "/api/auth/logout"
}

function expireSid(res: NextResponse) {
  res.cookies.set("sid", "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" })
}

function nodeRequest(
  url: URL,
  method: string,
  headers: OutgoingHttpHeaders,
  body?: Buffer
): Promise<{ status: number; headers: IncomingHttpHeaders; body: Buffer }> {
  const send = url.protocol === "https:" ? httpsRequest : httpRequest
  return new Promise((resolve, reject) => {
    const r = send(url, { method, headers }, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk) => chunks.push(chunk as Buffer))
      res.on("end", () =>
        resolve({
          status: res.statusCode ?? 502,
          headers: res.headers,
          body: Buffer.concat(chunks),
        })
      )
    })
    r.on("error", reject)
    if (body?.length) r.write(body)
    r.end()
  })
}
