import { UpstreamManager } from './manager.js';
import { prisma } from '../db/client.js';
import { computeToolsDigest } from './digest.js';

/**
 * Background health-check loop.
 * Every 30 seconds, pings each registered upstream and updates its DB status.
 */
export function startHealthLoop(manager: UpstreamManager): NodeJS.Timeout {
  return setInterval(async () => {
    const clients = manager.getAllClients();

    for (const [slug, client] of clients) {
      try {
        const row = await prisma.upstreamServer.findUnique({ where: { slug } });
        if (row && !row.enabled) {
          await prisma.upstreamServer.update({
            where: { slug },
            data: { status: 'disabled', lastCheckedAt: new Date() },
          });
          continue;
        }

        if (!client.isConnected()) {
          try {
            await client.connect();
          } catch {
            // connection failed, will mark as unreachable below
          }
        }

        if (client.isConnected()) {
          const tools = await client.listTools();
          const digest = computeToolsDigest(tools);

          await prisma.upstreamServer.update({
            where: { slug },
            data: {
              status: 'connected',
              lastCheckedAt: new Date(),
              lastError: null,
              toolsDigest: digest,
            },
          });
        } else {
          await prisma.upstreamServer.update({
            where: { slug },
            data: {
              status: 'unreachable',
              lastCheckedAt: new Date(),
              lastError: 'Not connected',
            },
          });
        }
      } catch (error: any) {
        console.error(`[health] Check failed for ${slug}:`, error.message);
        try {
          await prisma.upstreamServer.update({
            where: { slug },
            data: {
              status: 'unreachable',
              lastCheckedAt: new Date(),
              lastError: error.message || 'Unknown error',
            },
          });
        } catch {
          // server might not exist in DB yet
        }
      }
    }
  }, 30000);
}

export function stopHealthLoop(timer: NodeJS.Timeout): void {
  clearInterval(timer);
}
