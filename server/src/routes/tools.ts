import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import type { UpstreamManager } from '../upstream/manager.js';
import { listAllTools } from '../aggregator/listTools.js';

export function createToolsRouter(manager: UpstreamManager): Router {
  const router = Router();
  
  router.get('/', requireAuth, async (req, res) => {
    try {
      const tools = await listAllTools(manager, req.principal!);
      res.json({ tools });
    } catch (err: any) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message || 'Failed to list tools' } });
    }
  });

  return router;
}
