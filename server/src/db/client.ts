import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { config } from '../config.js';

const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
const adapter = new PrismaPg(pool);

/**
 * Singleton Prisma client instance (Prisma 7 + PostgreSQL driver adapter).
 */
export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
  await pool.end();
}
