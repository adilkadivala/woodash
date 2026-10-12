import express from 'express';
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
      if (!auth?.startsWith('Bearer ') || auth.slice(7) !== options.bearerToken) {
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
