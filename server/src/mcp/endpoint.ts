import { Router } from 'express';
import type { Request, Response } from 'express';
import { verifyApiKey } from '../auth/apiKeys.js';
import { executeTool } from '../executor/executeTool.js';
import { listAllTools } from '../aggregator/listTools.js';
import type { UpstreamManager } from '../upstream/manager.js';
import type { Principal } from '../auth/principal.js';

/**
 * MCP Streamable HTTP endpoint.
 *
 * External clients (Claude Code, Cursor, MCP Inspector) POST JSON-RPC
 * messages to /mcp with a Bearer API key. This handler implements the
 * core MCP protocol methods: initialize, ping, tools/list, tools/call.
 */
export function createMcpRouter(manager: UpstreamManager): Router {
  const router = Router();

  // Only POST is allowed for Streamable HTTP
  router.get('/', (_req: Request, res: Response) => {
    res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for MCP requests' } });
  });

  router.delete('/', (_req: Request, res: Response) => {
    res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for MCP requests' } });
  });

  router.post('/', async (req: Request, res: Response) => {
    // --- Auth: verify API key ---
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32000, message: 'Missing or invalid Authorization header. Use: Bearer kgw_...' },
      });
      return;
    }

    const token = authHeader.substring(7);
    const keyInfo = await verifyApiKey(token);
    if (!keyInfo) {
      res.status(401).json({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32000, message: 'Invalid or revoked API key' },
      });
      return;
    }

    const principal: Principal = {
      userId: keyInfo.userId,
      role: keyInfo.role as 'admin' | 'member',
      via: 'apikey',
      apiKeyId: keyInfo.keyId,
    };

    // --- Parse JSON-RPC ---
    let body: { jsonrpc?: string; id?: number | string | null; method?: string; params?: Record<string, unknown> };
    try {
      body = req.body;
      if (!body || typeof body !== 'object') {
        throw new Error('Invalid JSON');
      }
    } catch {
      res.status(400).json({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error: invalid JSON' },
      });
      return;
    }

    const { id = null, method, params } = body;

    if (!method) {
      res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32600, message: 'Invalid request: missing method' },
      });
      return;
    }

    // --- Route by method ---
    try {
      switch (method) {
        case 'initialize': {
          res.json({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2025-03-26',
              capabilities: { tools: {} },
              serverInfo: {
                name: 'mcp-gateway',
                version: '1.0.0',
              },
            },
          });
          break;
        }

        case 'ping': {
          res.json({ jsonrpc: '2.0', id, result: {} });
          break;
        }

        case 'notifications/initialized': {
          // Client notification after initialize — acknowledge silently
          res.json({ jsonrpc: '2.0', id, result: {} });
          break;
        }

        case 'tools/list': {
          const tools = await listAllTools(manager, principal);
          res.json({
            jsonrpc: '2.0',
            id,
            result: {
              tools: tools.map((t) => ({
                name: t.name,
                description: t.description ?? '',
                inputSchema: t.inputSchema ?? { type: 'object', properties: {} },
              })),
            },
          });
          break;
        }

        case 'tools/call': {
          const toolName = (params as Record<string, unknown>)?.name as string;
          const toolArgs = ((params as Record<string, unknown>)?.arguments ?? {}) as Record<string, unknown>;

          if (!toolName) {
            res.json({
              jsonrpc: '2.0',
              id,
              error: { code: -32602, message: 'Invalid params: missing tool name' },
            });
            return;
          }

          const result = await executeTool(manager, principal, toolName, toolArgs, { via: 'mcp' });

          res.json({
            jsonrpc: '2.0',
            id,
            result: {
              content: result.content,
              isError: result.isError ?? false,
            },
          });
          break;
        }

        default: {
          res.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` },
          });
        }
      }
    } catch (error) {
      console.error('[mcp] Handler error:', error);
      res.json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      });
    }
  });

  return router;
}
