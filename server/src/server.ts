import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';

// Routes
import authRouter from './routes/auth.js';
import { createMembersRouter } from './routes/members.js';
import { createKeysRouter } from './routes/keys.js';
import { createServersRouter } from './routes/servers.js';
import { createToolsRouter } from './routes/tools.js';
import { createAuditRouter } from './routes/audit.js';
import { createChatRouter } from './routes/chat.js';
import { createHealthRouter } from './routes/health.js';
import { createMcpRouter } from './mcp/endpoint.js';

// Upstream
import type { UpstreamManager } from './upstream/manager.js';

/**
 * Create and configure the Express application.
 * The UpstreamManager is injected so routes can access upstream clients.
 */
export function createApp(manager: UpstreamManager): express.Express {
  const app = express();

  // ─── Global middleware ───
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));

  // ─── Health (no auth) ───
  const healthRouter = createHealthRouter();
  app.use('/', healthRouter);

  // ─── Auth routes ───
  app.use('/api/auth', authRouter);

  // ─── API routes ───
  app.use('/api/members', createMembersRouter());
  app.use('/api/keys', createKeysRouter());
  app.use('/api/servers', createServersRouter(manager));
  app.use('/api/tools', createToolsRouter(manager));
  app.use('/api/audit', createAuditRouter());
  app.use('/api/chat', createChatRouter(manager));

  // ─── MCP endpoint (external clients) ───
  app.use('/mcp', createMcpRouter(manager));

  // ─── Global error handler ───
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[server] Unhandled error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: config.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      },
    });
  });

  return app;
}
