import { Router } from 'express';
import { prisma } from '../db/client.js';

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/healthz', (req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/readyz', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch (err: any) {
      res.status(503).json({ status: 'not ready', error: err.message || 'Database connection failed' });
    }
  });

  return router;
}
