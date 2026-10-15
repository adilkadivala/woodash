import type { NextConfig } from "next"

/** API traffic is proxied via `app/api/[...path]/route.ts` and `app/mcp/route.ts` (forwards cookies + SSE). */
const nextConfig: NextConfig = {
  output: "standalone",
}

export default nextConfig
