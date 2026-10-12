import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Singleton Prisma client instance.
 * Reused across the application to maintain a single connection pool.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['warn', 'error']
    : ['error'],
});

/**
 * Gracefully disconnect Prisma on shutdown.
 */
export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
