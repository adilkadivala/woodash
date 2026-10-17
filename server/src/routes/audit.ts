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

    // Fetched one extra row to detect another page. The cursor is the last row we
    // return (the query skips the cursor row itself), so nothing is dropped.
    let nextCursor: number | undefined;
    if (logs.length > queryLimit) {
      logs.pop();
      nextCursor = logs[logs.length - 1].id;
    }

    res.json({ logs, cursor: nextCursor });
  });

  /**
   * GET /stats - Tool-call metrics for the overview: calls per day (success vs
   * failed) and per-server volume, error rate and latency. Same visibility as
   * the log itself (members see their own calls).
   */
  router.get('/stats', requireAuth, async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 14, 1), 90);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const where: any = { ts: { gte: since } };
    if (req.principal!.role !== 'admin') where.userId = req.principal!.userId;

    const rows = await prisma.auditLog.findMany({
      where,
      select: { ts: true, serverSlug: true, outcome: true, durationMs: true },
      orderBy: { id: 'desc' },
      take: 50_000,
    });

    const daily = new Map<string, { date: string; success: number; failed: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      daily.set(key, { date: key, success: 0, failed: 0 });
    }

    const perServer = new Map<string, { calls: number; errors: number; durations: number[] }>();
    for (const r of rows) {
      const bucket = daily.get(r.ts.toISOString().slice(0, 10));
      const ok = r.outcome === 'success';
      if (bucket) ok ? bucket.success++ : bucket.failed++;

      const slug = r.serverSlug ?? '(unknown)';
      const s = perServer.get(slug) ?? { calls: 0, errors: 0, durations: [] };
      s.calls++;
      if (!ok) s.errors++;
      if (typeof r.durationMs === 'number') s.durations.push(r.durationMs);
      perServer.set(slug, s);
    }

    const servers = [...perServer.entries()]
      .map(([slug, s]) => {
        const sorted = s.durations.sort((a, b) => a - b);
        const pct = (p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0);
        return {
          slug,
          calls: s.calls,
          errors: s.errors,
          errorRate: s.calls ? s.errors / s.calls : 0,
          p50Ms: pct(0.5),
          p95Ms: pct(0.95),
        };
      })
      .sort((a, b) => b.calls - a.calls);

    res.json({ days, daily: [...daily.values()], servers, total: rows.length });
  });

  return router;
}
