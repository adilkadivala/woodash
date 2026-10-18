import { Router } from 'express';
import { prisma } from '../db/client.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { validateUpstreamUrl } from '../security/ssrf.js';
import { encryptCredential } from '../security/crypto.js';
import { UpstreamClient } from '../upstream/client.js';
import { encodeToolName } from '../aggregator/naming.js';
import type { UpstreamManager } from '../upstream/manager.js';

function idParam(raw: string | string[]): string {
  return Array.isArray(raw) ? raw[0] : raw;
}

async function toolCountForSlug(manager: UpstreamManager, slug: string): Promise<number> {
  const client = manager.getClient(slug);
  if (!client?.isConnected()) return 0;
  try {
    const tools = await client.listTools();
    return tools.length;
  } catch {
    return 0;
  }
}

export function createServersRouter(manager: UpstreamManager): Router {
  const router = Router();

  // List all upstream servers
  router.get('/', requireAuth, async (req, res) => {
    const servers = await prisma.upstreamServer.findMany();
    const result = await Promise.all(
      servers.map(async (s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        url: s.url,
        authType: s.authType,
        authHeaderName: s.authHeaderName,
        hasCredential: !!s.credentialEnc,
        enabled: s.enabled,
        status: s.enabled ? s.status : 'disabled',
        lastError: s.lastError,
        lastCheckedAt: s.lastCheckedAt,
        toolsDigest: s.toolsDigest,
        toolCount: s.enabled && s.status === 'connected' ? await toolCountForSlug(manager, s.slug) : 0,
      })),
    );
    res.json({ servers: result });
  });

  // Add a new upstream server
  router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    const { slug, name, url, authType, authHeaderName, credential, enabled } = req.body;

    if (!slug || !/^[a-z][a-z0-9-]{0,31}$/.test(slug)) {
      res.status(400).json({ error: { code: 'INVALID_SLUG', message: 'Slug must match: ^[a-z][a-z0-9-]{0,31}$' } });
      return;
    }

    if (!name || !url) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Name and URL are required' } });
      return;
    }

    // SSRF check
    const urlCheck = await validateUpstreamUrl(url);
    if (!urlCheck.valid) {
      res.status(400).json({ error: { code: 'URL_NOT_ALLOWED', message: urlCheck.reason || 'URL blocked by SSRF policy' } });
      return;
    }

    const credentialEnc = credential
      ? (encryptCredential(credential) as Uint8Array<ArrayBuffer>)
      : null;

    try {
      const server = await prisma.upstreamServer.create({
        data: {
          slug,
          name,
          url,
          authType: authType || 'none',
          authHeaderName: authHeaderName || null,
          credentialEnc: credentialEnc ?? undefined,
          enabled: enabled ?? true,
        },
      });

      // Register with upstream manager
      if (server.enabled) {
        await manager.addServer(slug, url, server.authType, authHeaderName, credential);
      }

      res.status(201).json({
        server: {
          id: server.id,
          slug: server.slug,
          name: server.name,
          url: server.url,
          authType: server.authType,
          authHeaderName: server.authHeaderName,
          hasCredential: !!credentialEnc,
          enabled: server.enabled,
          status: server.status,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        res.status(409).json({ error: { code: 'SLUG_TAKEN', message: `Server with slug "${slug}" already exists` } });
      } else {
        res.status(400).json({ error: { code: 'CREATE_FAILED', message: 'Failed to create server' } });
      }
    }
  });

  // Test connection without saving
  router.post('/test', requireAuth, requireRole('admin'), async (req, res) => {
    const { url, authType, authHeaderName, credential } = req.body;

    if (!url) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'URL is required' } });
      return;
    }

    const urlCheck = await validateUpstreamUrl(url);
    if (!urlCheck.valid) {
      res.status(400).json({ connected: false, error: urlCheck.reason });
      return;
    }

    const client = new UpstreamClient('test', url, authType || 'none', authHeaderName, credential);
    try {
      await client.connect();
      const tools = await client.listTools();
      await client.disconnect();
      res.json({ connected: true, tools: tools.map((t: any) => ({ name: t.name, description: t.description })) });
    } catch (err: any) {
      try { await client.disconnect(); } catch {}
      res.json({ connected: false, error: err.message || 'Connection failed' });
    }
  });

  // Get server detail
  router.get('/:id', requireAuth, async (req, res) => {
    const server = await prisma.upstreamServer.findUnique({ where: { id: idParam(req.params.id) } });
    if (!server) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Server not found' } });
      return;
    }
    res.json({
      server: {
        id: server.id,
        slug: server.slug,
        name: server.name,
        url: server.url,
        authType: server.authType,
        authHeaderName: server.authHeaderName,
        hasCredential: !!server.credentialEnc,
        enabled: server.enabled,
        status: server.status,
        lastError: server.lastError,
        lastCheckedAt: server.lastCheckedAt,
        toolsDigest: server.toolsDigest,
      },
    });
  });

  // Update server
  router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const { name, url, authType, authHeaderName, credential, enabled } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (authType !== undefined) data.authType = authType;
    if (authHeaderName !== undefined) data.authHeaderName = authHeaderName;
    if (enabled !== undefined) data.enabled = enabled;

    if (url !== undefined) {
      const urlCheck = await validateUpstreamUrl(url);
      if (!urlCheck.valid) {
        res.status(400).json({ error: { code: 'URL_NOT_ALLOWED', message: urlCheck.reason } });
        return;
      }
      data.url = url;
    }

    if (credential !== undefined) {
      data.credentialEnc = credential ? encryptCredential(credential) : null;
    }

    try {
      const server = await prisma.upstreamServer.update({ where: { id: idParam(req.params.id) }, data });
      if (server.enabled) {
        await manager.refreshServer(server.slug);
      }
      res.json({
        server: {
          id: server.id, slug: server.slug, name: server.name, url: server.url,
          authType: server.authType, authHeaderName: server.authHeaderName,
          hasCredential: !!server.credentialEnc, enabled: server.enabled, status: server.status,
        },
      });
    } catch {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Server not found' } });
    }
  });

  // Enable server
  router.post('/:id/enable', requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const server = await prisma.upstreamServer.update({ where: { id: idParam(req.params.id) }, data: { enabled: true } });
      await manager.enableServer(server.slug);
      res.json({ server: { id: server.id, slug: server.slug, name: server.name, enabled: true, status: server.status } });
    } catch {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Server not found' } });
    }
  });

  // Disable server
  router.post('/:id/disable', requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const server = await prisma.upstreamServer.update({
        where: { id: idParam(req.params.id) },
        data: { enabled: false, status: 'disabled' },
      });
      await manager.disableServer(server.slug);
      res.json({ server: { id: server.id, slug: server.slug, name: server.name, enabled: false, status: server.status } });
    } catch {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Server not found' } });
    }
  });

  // Refresh server (reconnect + re-list tools)
  router.post('/:id/refresh', requireAuth, requireRole('admin'), async (req, res) => {
    const server = await prisma.upstreamServer.findUnique({ where: { id: idParam(req.params.id) } });
    if (!server) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Server not found' } });
      return;
    }
    await manager.refreshServer(server.slug);
    const updated = await prisma.upstreamServer.findUnique({ where: { id: idParam(req.params.id) } });
    res.json({ server: { id: updated!.id, slug: updated!.slug, name: updated!.name, enabled: updated!.enabled, status: updated!.status } });
  });

  // List tools for a specific server
  router.get('/:id/tools', requireAuth, async (req, res) => {
    const server = await prisma.upstreamServer.findUnique({ where: { id: idParam(req.params.id) } });
    if (!server) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Server not found' } });
      return;
    }
    const client = manager.getClient(server.slug);
    if (!client || !client.isConnected()) {
      res.json({ tools: [] });
      return;
    }
    try {
      const rawTools = await client.listTools();
      const tools = rawTools.map((t: any) => ({
        name: encodeToolName(server.slug, t.name),
        description: t.description,
        inputSchema: t.inputSchema,
        serverSlug: server.slug,
        serverName: server.name,
      }));
      res.json({ tools });
    } catch {
      res.json({ tools: [] });
    }
  });

  // Delete server
  router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const server = await prisma.upstreamServer.findUnique({ where: { id: idParam(req.params.id) } });
    if (!server) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Server not found' } });
      return;
    }
    await manager.removeServer(server.slug);
    await prisma.upstreamServer.delete({ where: { id: idParam(req.params.id) } });
    res.status(204).end();
  });

  return router;
}
