import type { UpstreamManager } from './manager.js';
import { prisma } from '../db/client.js';
import { computeToolsDigest } from './digest.js';

const HEALTH_INTERVAL_MS = Number(process.env.HEALTH_INTERVAL_MS || 15000);

/**
 * Probe one upstream and persist its status. Never throws.
 * The client's connect/listTools carry their own timeouts, so a hung
 * upstream resolves to 'unreachable' instead of stalling the caller.
 */
export async function checkServerHealth(manager: UpstreamManager, slug: string): Promise<void> {
  try {
    const row = await prisma.upstreamServer.findUnique({ where: { slug } });
    if (!row) return;
    if (!row.enabled) {
      await prisma.upstreamServer.update({
        where: { slug },
        data: { status: 'disabled', lastCheckedAt: new Date() },
      });
      return;
    }

    const client = manager.getClient(slug);
    if (!client) throw new Error('No client registered');
    if (!client.isConnected()) await client.connect();

    const tools = await client.listTools();
    await prisma.upstreamServer.update({
      where: { slug },
      data: {
        status: 'connected',
        lastCheckedAt: new Date(),
        lastError: null,
        toolsDigest: computeToolsDigest(tools),
      },
    });
  } catch (error: any) {
    const message = describeError(error);
    console.error(`[health] Check failed for ${slug}: ${message}`);
    // Force a fresh connect next time; a stale session may survive a pod restart.
    await manager.getClient(slug)?.disconnect().catch(() => {});
    await prisma.upstreamServer
      .update({
        where: { slug },
        data: { status: 'unreachable', lastCheckedAt: new Date(), lastError: message },
      })
      .catch(() => {});
  }
}

function describeError(error: any): string {
  const cause = error?.cause?.code || error?.cause?.message;
  const base = error?.message || 'Unknown error';
  return cause && !base.includes(cause) ? `${base} (${cause})` : base;
}

export async function checkAllServers(manager: UpstreamManager): Promise<void> {
  const slugs = (await prisma.upstreamServer.findMany({ select: { slug: true } })).map((s) => s.slug);
  await Promise.allSettled(slugs.map((slug) => checkServerHealth(manager, slug)));
}

/**
 * Background health-check loop: checks every upstream in parallel, at boot
 * and then every HEALTH_INTERVAL_MS. Runs never overlap.
 */
export function startHealthLoop(manager: UpstreamManager): NodeJS.Timeout {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await checkAllServers(manager);
    } finally {
      running = false;
    }
  };
  void tick();
  return setInterval(tick, HEALTH_INTERVAL_MS);
}

export function stopHealthLoop(timer: NodeJS.Timeout): void {
  clearInterval(timer);
}
