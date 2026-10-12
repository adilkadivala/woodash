import type { NextConfig } from "next"

const gateway = process.env.SERVER_GATEWAY_URL || "http://localhost:4000"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/chat/:path*",
        destination: `${gateway}/api/chat/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${gateway}/api/:path*`,
      },
      {
        source: "/mcp",
        destination: `${gateway}/mcp`,
      },
    ]
  },
  output: "standalone",
}

export default nextConfig
