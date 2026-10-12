import { Router } from 'express';
import { prisma } from '../db/client.js';
import { requireAuth } from '../auth/middleware.js';
import { generateApiKey, revokeApiKey } from '../auth/apiKeys.js';

export function createKeysRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const { userId } = req.query;
    
    let queryUserId = req.principal!.userId;
    if (req.principal!.role === 'admin' && userId) {
      queryUserId = userId as string;
    } else if (req.principal!.role === 'admin' && Object.keys(req.query).includes('all')) {
        queryUserId = undefined as any;
    }

    const where: any = {};
    if (queryUserId) {
        where.userId = queryUserId;
    }

    const keys = await prisma.apiKey.findMany({
      where,
      select: { id: true, name: true, keyPrefix: true, createdAt: true, lastUsedAt: true, revokedAt: true, userId: true }
    });
    res.json({ keys });
  });

  router.post('/', async (req, res) => {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Name is required' } });
    }

    const { key, plaintext } = await generateApiKey(req.principal!.userId, name);
    res.status(201).json({ key, plaintext });
  });

  router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    const key = await prisma.apiKey.findUnique({ where: { id } });
    if (!key) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Key not found' } });
    }

    if (key.userId !== req.principal!.userId && req.principal!.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to revoke this key' } });
    }

    await revokeApiKey(id);
    res.status(204).end();
  });

  return router;
}
