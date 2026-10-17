import { existsSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { prisma } from '../db/client.js';
import type { UpstreamManager } from '../upstream/manager.js';
import { encryptCredential } from '../security/crypto.js';
import { decryptStoreSecrets, encryptStoreSecrets, generateStoreSecrets } from './secrets.js';
import { provisioningAvailable, runHelm, runKubectl } from './helm.js';

const inFlight = new Set<string>();

export function storeNamespace(slug: string): string {
  return `store-${slug}`;
}

export function storeMcpSlug(slug: string): string {
  return `woo-${slug}`;
}

export function storeHost(slug: string): string {
  return `${slug}.${config.STORE_HOST_SUFFIX}`;
}

export function storeMcpUrl(slug: string): string {
  return `http://woo-mcp.${storeNamespace(slug)}.svc.cluster.local:${config.WOO_MCP_PORT}/mcp`;
}

function chartPath(): string {
  if (existsSync(config.STORE_CHART_PATH)) return config.STORE_CHART_PATH;
  const fallback = join(dirname(fileURLToPath(import.meta.url)), '../../../charts/store');
  return fallback;
}

function timedOut(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() > config.STORE_PROVISION_TIMEOUT_SEC * 1000;
}

async function ensureSecrets(storeId: string): Promise<ReturnType<typeof generateStoreSecrets>> {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
  if (store.secretsEnc) return decryptStoreSecrets(store.secretsEnc);
  const secrets = generateStoreSecrets(store.slug);
  await prisma.store.update({
    where: { id: storeId },
    data: { secretsEnc: encryptStoreSecrets(secrets) },
  });
  return secrets;
}

async function labelNamespace(namespace: string, slug: string): Promise<void> {
  const result = await runKubectl(
    ['label', 'namespace', namespace, 'urumi.ai/kind=store', `urumi.ai/store=${slug}`, '--overwrite'],
    30_000,
  );
  if (result.code !== 0) {
    console.warn(`[provisioner] label ${namespace}: ${result.stderr.trim()}`);
  }
}

async function helmUpgrade(store: {
  slug: string;
  name: string;
  host: string;
  namespace: string;
}, secrets: ReturnType<typeof generateStoreSecrets>, timeoutMs: number) {
  const dir = await mkdtemp(join(tmpdir(), 'store-values-'));
  const valuesPath = join(dir, 'values.yaml');
  const [repo, tag] = config.WOO_MCP_IMAGE.includes(':')
    ? (config.WOO_MCP_IMAGE.split(':') as [string, string])
    : [config.WOO_MCP_IMAGE, 'local'];

  const values = {
    store: { slug: store.slug, name: store.name, host: store.host },
    ingress: {
      enabled: true,
      className: config.STORE_INGRESS_CLASS,
      tls: config.STORE_TLS,
    },
    storageClass: config.STORE_STORAGE_CLASS,
    images: {
      wordpress: config.WORDPRESS_IMAGE,
      wordpressCli: config.WORDPRESS_CLI_IMAGE,
      mariadb: config.MARIADB_IMAGE,
      wooMcp: { repository: repo, tag, pullPolicy: 'IfNotPresent' },
    },
    gateway: { namespace: config.GATEWAY_NAMESPACE },
    secrets,
  };

  try {
    await writeFile(valuesPath, JSON.stringify(values), { mode: 0o600 });
    const result = await runHelm(
      [
        'upgrade',
        '--install',
        `store-${store.slug}`,
        chartPath(),
        '-n',
        store.namespace,
        '--create-namespace',
        '-f',
        valuesPath,
        '--wait',
        '--timeout',
        `${Math.max(60, Math.floor(timeoutMs / 1000))}s`,
      ],
      timeoutMs + 15_000,
    );
    if (result.code !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || `helm exited ${result.code}`);
    }
    await labelNamespace(store.namespace, store.slug);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function registerMcp(
  manager: UpstreamManager,
  store: { id: string; slug: string; name: string },
  token: string,
): Promise<void> {
  const mcpSlug = storeMcpSlug(store.slug);
  const url = storeMcpUrl(store.slug);
  const credentialEnc = encryptCredential(token) as Uint8Array<ArrayBuffer>;

  const existing = await prisma.upstreamServer.findUnique({ where: { slug: mcpSlug } });
  if (existing) {
    await prisma.upstreamServer.update({
      where: { id: existing.id },
      data: {
        name: `WooCommerce (${store.name})`,
        url,
        authType: 'bearer',
        credentialEnc,
        enabled: true,
        status: 'unknown',
        lastError: null,
      },
    });
  } else {
    await prisma.upstreamServer.create({
      data: {
        slug: mcpSlug,
        name: `WooCommerce (${store.name})`,
        url,
        authType: 'bearer',
        credentialEnc,
        enabled: true,
      },
    });
  }

  await manager.addServer(mcpSlug, url, 'bearer', undefined, token);
  await prisma.store.update({
    where: { id: store.id },
    data: { mcpSlug },
  });
}

async function unregisterMcp(manager: UpstreamManager, mcpSlug: string | null): Promise<void> {
  if (!mcpSlug) return;
  try {
    await manager.removeServer(mcpSlug);
  } catch (err) {
    console.warn(`[provisioner] disconnect ${mcpSlug}:`, err);
  }
  await prisma.upstreamServer.deleteMany({ where: { slug: mcpSlug } });
}

async function provisionOne(manager: UpstreamManager, storeId: string): Promise<void> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || store.status !== 'provisioning') return;

  const avail = provisioningAvailable();
  if (!avail.ok) {
    await prisma.store.update({
      where: { id: storeId },
      data: { status: 'failed', lastError: avail.reason },
    });
    return;
  }

  if (timedOut(store.createdAt)) {
    await prisma.store.update({
      where: { id: storeId },
      data: { status: 'failed', lastError: 'PROVISIONING_TIMEOUT' },
    });
    return;
  }

  const remaining = config.STORE_PROVISION_TIMEOUT_SEC * 1000 - (Date.now() - store.createdAt.getTime());

  try {
    const secrets = await ensureSecrets(storeId);
    await helmUpgrade(store, secrets, remaining);
    await registerMcp(manager, store, secrets.wooMcpToken);
    await prisma.store.update({
      where: { id: storeId },
      data: {
        status: 'ready',
        lastError: null,
        provisionedAt: new Date(),
        mcpSlug: storeMcpSlug(store.slug),
      },
    });
    console.log(`[provisioner] store ${store.slug} ready`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = timedOut(store.createdAt) || message.includes('PROVISIONING_TIMEOUT');
    await prisma.store.update({
      where: { id: storeId },
      data: {
        status: failed ? 'failed' : 'provisioning',
        lastError: message.slice(0, 2000),
      },
    });
    console.error(`[provisioner] store ${store.slug}:`, message);
  }
}

async function deleteOne(manager: UpstreamManager, storeId: string): Promise<void> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || store.status !== 'deleting') return;

  await unregisterMcp(manager, store.mcpSlug);

  const avail = provisioningAvailable();
  if (avail.ok) {
    const uninstall = await runHelm(
      ['uninstall', `store-${store.slug}`, '-n', store.namespace, '--wait', '--timeout', '120s'],
      150_000,
    );
    if (uninstall.code !== 0) {
      console.warn(`[provisioner] helm uninstall ${store.slug}: ${uninstall.stderr}`);
    }
    const ns = await runKubectl(['delete', 'namespace', store.namespace, '--wait=true', '--ignore-not-found=true'], 180_000);
    if (ns.code !== 0) {
      console.warn(`[provisioner] delete ns ${store.namespace}: ${ns.stderr}`);
    }
  }

  await prisma.store.delete({ where: { id: storeId } });
  console.log(`[provisioner] store ${store.slug} removed`);
}

async function tick(manager: UpstreamManager): Promise<void> {
  const due = await prisma.store.findMany({
    where: { status: { in: ['provisioning', 'deleting'] } },
    orderBy: { createdAt: 'asc' },
  });
  for (const store of due) {
    if (inFlight.has(store.id)) continue;
    inFlight.add(store.id);
    const run =
      store.status === 'deleting' ? deleteOne(manager, store.id) : provisionOne(manager, store.id);
    void run.finally(() => inFlight.delete(store.id));
  }
}

export function startStoreWorker(manager: UpstreamManager): ReturnType<typeof setInterval> {
  void tick(manager);
  return setInterval(() => {
    void tick(manager);
  }, 8_000);
}
