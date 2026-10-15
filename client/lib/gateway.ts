/** Gateway base URL (server-side only — used by Next.js API proxy). */
export function getGatewayUrl(): string {
  return process.env.SERVER_GATEWAY_URL || "http://127.0.0.1:4000"
}

export const useMockApi =
  process.env.NEXT_PUBLIC_USE_MOCK_API === "true"
