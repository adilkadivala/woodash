import { prisma } from './db/client.js';
import { config } from './config.js';
import { hashPassword } from './auth/passwords.js';
import { encryptCredential } from './security/crypto.js';

type SeedUpstream = {
  slug: string;
  name: string;
  url: string;
  authType: 'none' | 'bearer' | 'header';
  authHeaderName?: string;
  token?: string;
};

/**
 * Bootstrap seed — runs on every startup (idempotent).
 */
export async function seed(): Promise<void> {
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const passwordHash = await hashPassword(config.BOOTSTRAP_ADMIN_PASSWORD);
    const admin = await prisma.user.create({
      data: {
        email: config.BOOTSTRAP_ADMIN_EMAIL,
        name: 'Admin',
        passwordHash,
        role: 'admin',
      },
    });
    console.log(`[seed] ✅ Created bootstrap admin: ${admin.email} (id: ${admin.id})`);
  } else {
    console.log(`[seed] Admin user already exists, skipping bootstrap.`);
  }

  const upstreams: SeedUpstream[] = [
    {
      slug: 'woo',
      name: 'WooCommerce MCP',
      url: config.WOO_MCP_URL,
      authType: 'bearer',
      token: config.WOO_MCP_TOKEN,
    },
    {
      slug: 'utils',
      name: 'Utils MCP',
      url: config.UTILS_MCP_URL,
      authType: 'none',
    },
    {
      slug: 'notes',
      name: 'Notes MCP',
      url: config.NOTES_MCP_URL,
      authType: 'bearer',
      token: config.NOTES_MCP_TOKEN,
    },
  ];

  for (const upstream of upstreams) {
    if (!upstream.url) continue;

    const existing = await prisma.upstreamServer.findUnique({ where: { slug: upstream.slug } });
    if (existing) {
      console.log(`[seed] Upstream "${upstream.slug}" already registered.`);
      continue;
    }

    const credentialEnc =
      upstream.authType !== 'none' && upstream.token
        ? (encryptCredential(upstream.token) as Uint8Array<ArrayBuffer>)
        : null;

    await prisma.upstreamServer.create({
      data: {
        slug: upstream.slug,
        name: upstream.name,
        url: upstream.url,
        authType: upstream.authType,
        authHeaderName: upstream.authHeaderName ?? null,
        credentialEnc: credentialEnc ?? undefined,
        enabled: true,
      },
    });
    console.log(`[seed] ✅ Registered upstream "${upstream.slug}" at ${upstream.url}`);
  }
}
