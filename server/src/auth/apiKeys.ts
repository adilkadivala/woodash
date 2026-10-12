import crypto from 'node:crypto';
import { prisma } from '../db/client.js';

/**
 * Hash an API key using SHA-256 for secure storage.
 */
function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a new API key for a user.
 *
 * Format: `kgw_` + 48 random hex chars (24 bytes).
 * Only the SHA-256 hash is stored; the plaintext is returned once.
 */
export async function generateApiKey(
  userId: string,
  name: string,
): Promise<{ key: { id: string; name: string; keyPrefix: string; createdAt: Date }; plaintext: string }> {
  const randomHex = crypto.randomBytes(24).toString('hex'); // 48 chars
  const plaintext = `kgw_${randomHex}`;
  const keyPrefix = plaintext.substring(0, 10);
  const keyHash = hashKey(plaintext);

  const apiKey = await prisma.apiKey.create({
    data: {
      userId,
      name,
      keyPrefix,
      keyHash,
    },
  });

  return {
    key: {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      createdAt: apiKey.createdAt,
    },
    plaintext,
  };
}

/**
 * Verify an API key and return the associated user and role.
 * Updates lastUsedAt on successful verification.
 * Returns null if the key is invalid, revoked, or the user is disabled.
 */
export async function verifyApiKey(
  key: string,
): Promise<{ userId: string; role: string; keyId: string } | null> {
  const keyHash = hashKey(key);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: true },
  });

  if (!apiKey) return null;
  if (apiKey.revokedAt) return null;
  if (apiKey.user.disabled) return null;

  // Update last used timestamp (fire-and-forget)
  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {}); // non-blocking

  return {
    userId: apiKey.userId,
    role: apiKey.user.role,
    keyId: apiKey.id,
  };
}

/**
 * Revoke an API key by setting revokedAt.
 */
export async function revokeApiKey(keyId: string): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });
}
