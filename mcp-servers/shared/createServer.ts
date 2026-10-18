import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export type McpServerFactory = () => McpServer;

export function createMcpHttpApp(options: {
  bearerToken?: string;
  createServer: McpServerFactory;
}): express.Express {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/mcp', async (req, res) => {
    if (options.bearerToken) {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ') || !safeEqual(auth.slice(7), options.bearerToken)) {
        res.status(401).json({ error: { message: 'Invalid bearer token' } });
        return;
      }
    }

    const server = options.createServer();
    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on('close', () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });
    } catch (error) {
      console.error('[mcp] request error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed. Use POST.' },
      id: null,
    });
  });

  app.delete('/mcp', (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed. Use POST.' },
      id: null,
    });
  });

  return app;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Listen and shut down promptly on SIGTERM: stop accepting, drop idle
 * keep-alive sockets (so the gateway stops reusing a terminating pod),
 * and exit once in-flight requests finish (hard stop after 10s).
 */
export function listenWithGracefulShutdown(app: express.Express, port: number, name: string): void {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[${name}] listening on http://0.0.0.0:${port}/mcp`);
  });
  const shutdown = (signal: string) => {
    console.log(`[${name}] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
    server.closeIdleConnections?.();
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
