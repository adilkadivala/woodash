import { Router } from 'express';
import { prisma } from '../db/client.js';
import { requireAuth } from '../auth/middleware.js';

export function createAuditRouter(): Router {
  const router = Router();

  /**
   * GET / - Query audit logs with cursor-based pagination
   * Admin sees all, member sees own logs only.
   */
  router.get('/', requireAuth, async (req, res) => {
    const { userId, server, tool, outcome, from, to, limit = '50', cursor } = req.query;

    const queryLimit = Math.min(parseInt(limit as string) || 50, 200);
    const where: any = {};

    // Members can only see their own logs
    if (req.principal!.role !== 'admin') {
      where.userId = req.principal!.userId;
    } else if (userId) {
      where.userId = userId;
    }

    if (server) where.serverSlug = server;
    if (tool) where.toolName = tool;
    if (outcome) where.outcome = outcome;

    if (from || to) {
      where.ts = {};
      if (from) where.ts.gte = new Date(from as string);
      if (to) where.ts.lte = new Date(to as string);
    }

    // AuditLog.id is Int (autoincrement) — cursor must be a number
    const cursorId = cursor ? parseInt(cursor as string) : undefined;

    const logs = await prisma.auditLog.findMany({
      where,
      take: queryLimit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      orderBy: { id: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        apiKey: { select: { keyPrefix: true } },
      },
    });

    let nextCursor: number | undefined;
    if (logs.length > queryLimit) {
      const nextItem = logs.pop()!;
      nextCursor = nextItem.id;
    }

    res.json({ logs, cursor: nextCursor });
  });

  return router;
}
