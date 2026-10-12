import { NextResponse, type NextRequest } from "next/server"

const PUBLIC_PREFIXES = ["/login", "/invite"]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow next internals, api, images, favicon
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/mcp") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next()
  }

  const hasSession = req.cookies.has("sid")
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))

  // In production, enforce session cookie presence on protected routes
  // In development, allow gentle fallback if explicitly bypassing
  if (process.env.NODE_ENV === "production" && !hasSession && !isPublic) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
