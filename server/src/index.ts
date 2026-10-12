import { config } from './config.js';
import { prisma } from './db/client.js';
import { seed } from './seed.js';
import { createApp } from './server.js';
import { UpstreamManager } from './upstream/manager.js';
import { startHealthLoop, stopHealthLoop } from './upstream/health.js';

/**
 * Boot sequence:
 * 1. Run seed (admin + WooCommerce upstream)
 * 2. Initialize upstream manager (connect to all enabled servers)
 * 3. Start health-check loop
 * 4. Create Express app and listen
 */
async function main(): Promise<void> {
  console.log(`[boot] Starting MCP Gateway (${config.NODE_ENV})...`);

  // 1. Seed database
  await seed();

  // 2. Initialize upstream manager
  const manager = new UpstreamManager();
  await manager.initialize();
  console.log(`[boot] Upstream manager ready — ${manager.getAllSlugs().length} server(s) connected`);

  // 3. Start health-check loop (every 30s)
  const healthTimer = startHealthLoop(manager);

  // 4. Create and start Express app
  const app = createApp(manager);

  const server = app.listen(config.PORT, () => {
    console.log(`[boot] ✅ MCP Gateway listening on http://localhost:${config.PORT}`);
    console.log(`[boot]    Dashboard API: http://localhost:${config.PORT}/api`);
    console.log(`[boot]    MCP endpoint:  http://localhost:${config.PORT}/mcp`);
    console.log(`[boot]    Health check:  http://localhost:${config.PORT}/healthz`);
  });

  // ─── Graceful shutdown ───
  const shutdown = async (signal: string) => {
    console.log(`\n[shutdown] Received ${signal}, shutting down...`);

    // Stop health loop
    stopHealthLoop(healthTimer);

    // Close HTTP server
    server.close();

    // Disconnect Prisma
    await prisma.$disconnect();

    console.log('[shutdown] Done.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[boot] ❌ Fatal startup error:', err);
  process.exit(1);
});