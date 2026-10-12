import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.SERVER_GATEWAY_URL || "http://localhost:4000"}/api/:path*`,
      },
      {
        source: "/mcp/:path*",
        destination: `${process.env.SERVER_MCP_URL || "http://localhost:4001"}/mcp/:path*`,
      },
    ]
  },
  output: "standalone",
}

export default nextConfig
