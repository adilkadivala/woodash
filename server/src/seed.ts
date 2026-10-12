import { prisma } from './db/client.js';
import { config } from './config.js';
import { hashPassword } from './auth/passwords.js';
import { encryptCredential } from './security/crypto.js';

/**
 * Bootstrap seed — runs on every startup.
 *
 * 1. Creates the admin user if no users exist.
 * 2. Registers the WooCommerce MCP upstream if not already registered.
 *
 * All operations are idempotent (upsert or create-if-not-exists).
 */
export async function seed(): Promise<void> {
  // 1. Bootstrap admin user
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

  // 2. Register WooCommerce MCP server (if WOO_MCP_URL is set and slug doesn't exist)
  if (config.WOO_MCP_URL) {
    const existing = await prisma.upstreamServer.findUnique({ where: { slug: 'woo' } });
    if (!existing) {
      const credentialEnc = config.WOO_MCP_TOKEN
        ? encryptCredential(config.WOO_MCP_TOKEN)
        : null;

      await prisma.upstreamServer.create({
        data: {
          slug: 'woo',
          name: 'WooCommerce MCP',
          url: config.WOO_MCP_URL,
          authType: 'bearer',
          credentialEnc,
          enabled: true,
        },
      });
      console.log(`[seed] ✅ Registered WooCommerce MCP at ${config.WOO_MCP_URL}`);
    } else {
      console.log(`[seed] WooCommerce MCP already registered (slug: woo).`);
    }
  }
}
