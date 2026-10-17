import { Router } from 'express';
import { prisma } from '../db/client.js';
import { requireAuth } from '../auth/middleware.js';
import { config } from '../config.js';
import { provisioningAvailable } from '../provisioner/helm.js';
import { storeHost, storeMcpSlug, storeNamespace } from '../provisioner/worker.js';

const RESERVED = new Set([
  'woo',
  'utils',
  'notes',
  'platform',
  'default',
  'kube',
  'ingress',
  'store',
  'wordpress',
  'mariadb',
  'gateway',
  'app',
]);

const SLUG = /^[a-z][a-z0-9-]{0,19}$/;

function idParam(raw: string | string[]): string {
  return Array.isArray(raw) ? raw[0] : raw;
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);
}

function toDto(store: {
  id: string;
  slug: string;
  name: string;
  namespace: string;
  host: string;
  status: string;
  lastError: string | null;
  mcpSlug: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  provisionedAt: Date | null;
}) {
  const proto = config.STORE_TLS ? 'https' : 'http';
  return {
    id: store.id,
    slug: store.slug,
    name: store.name,
    namespace: store.namespace,
    host: store.host,
    storefrontUrl: `${proto}://${store.host}`,
    status: store.status,
    lastError: store.lastError,
    mcpSlug: store.mcpSlug,
    createdBy: store.createdBy,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
    provisionedAt: store.provisionedAt,
  };
}

export function createStoresRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const isAdmin = req.principal!.role === 'admin';
    const stores = await prisma.store.findMany({
      where: isAdmin ? undefined : { createdBy: req.principal!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      stores: stores.map(toDto),
      maxStoresPerUser: config.MAX_STORES_PER_USER,
      kubernetes: provisioningAvailable().ok,
    });
  });

  router.post('/', async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const rawSlug = typeof req.body?.slug === 'string' ? req.body.slug.trim() : slugFromName(name);

    if (!name) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Name is required' } });
      return;
    }
    if (!SLUG.test(rawSlug) || RESERVED.has(rawSlug) || rawSlug.startsWith('kube')) {
      res.status(400).json({
        error: {
          code: 'INVALID_SLUG',
          message: 'Slug must be 1–20 chars [a-z][a-z0-9-], and not a reserved name',
        },
      });
      return;
    }

    const existing = await prisma.store.findUnique({ where: { slug: rawSlug } });
    if (existing) {
      if (existing.createdBy !== req.principal!.userId && req.principal!.role !== 'admin') {
        res.status(409).json({ error: { code: 'SLUG_TAKEN', message: `Store slug "${rawSlug}" is taken` } });
        return;
      }
      if (existing.status === 'failed') {
        const retried = await prisma.store.update({
          where: { id: existing.id },
          data: { status: 'provisioning', lastError: null, name, createdAt: new Date() },
        });
        res.json({ store: toDto(retried) });
        return;
      }
      if (existing.status === 'provisioning' || existing.status === 'ready' || existing.status === 'deleting') {
        res.status(409).json({ error: { code: 'SLUG_TAKEN', message: `Store slug "${rawSlug}" already exists` } });
        return;
      }
    }

    const count = await prisma.store.count({
      where: { createdBy: req.principal!.userId, status: { not: 'deleting' } },
    });
    if (count >= config.MAX_STORES_PER_USER) {
      res.status(400).json({
        error: {
          code: 'STORE_LIMIT',
          message: `Maximum of ${config.MAX_STORES_PER_USER} stores per user`,
        },
      });
      return;
    }

    const mcpTaken = await prisma.upstreamServer.findUnique({ where: { slug: storeMcpSlug(rawSlug) } });
    if (mcpTaken) {
      res.status(409).json({
        error: { code: 'MCP_SLUG_TAKEN', message: `Upstream slug ${storeMcpSlug(rawSlug)} is already registered` },
      });
      return;
    }

    const avail = provisioningAvailable();
    const store = await prisma.store.create({
      data: {
        slug: rawSlug,
        name,
        namespace: storeNamespace(rawSlug),
        host: storeHost(rawSlug),
        status: avail.ok ? 'provisioning' : 'failed',
        lastError: avail.ok ? null : avail.reason,
        createdBy: req.principal!.userId,
      },
    });

    res.status(201).json({ store: toDto(store) });
  });

  router.post('/:id/retry', async (req, res) => {
    const id = idParam(req.params.id);
    const store = await prisma.store.findUnique({ where: { id } });
    if (!store) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Store not found' } });
      return;
    }
    if (store.createdBy !== req.principal!.userId && req.principal!.role !== 'admin') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not your store' } });
      return;
    }
    if (store.status !== 'failed' && store.status !== 'provisioning') {
      res.status(400).json({ error: { code: 'INVALID_STATE', message: 'Only failed stores can be retried' } });
      return;
    }
    const updated = await prisma.store.update({
      where: { id },
      data: { status: 'provisioning', lastError: null, createdAt: new Date() },
    });
    res.json({ store: toDto(updated) });
  });

  router.delete('/:id', async (req, res) => {
    const id = idParam(req.params.id);
    const store = await prisma.store.findUnique({ where: { id } });
    if (!store) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Store not found' } });
      return;
    }
    if (store.createdBy !== req.principal!.userId && req.principal!.role !== 'admin') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not your store' } });
      return;
    }
    const updated = await prisma.store.update({
      where: { id },
      data: { status: 'deleting', lastError: null },
    });
    res.json({ store: toDto(updated) });
  });

  return router;
}
