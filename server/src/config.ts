import { z } from 'zod/v4';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Application configuration parsed from environment variables.
 * Fails fast on missing required secrets.
 */
const configSchema = z.object({
  // Server
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string(),

  // Session
  SESSION_SECRET: z.string().min(32).default('dev-session-secret-change-in-production-please!!'),

  // Credential encryption key (32 bytes hex = 64 hex chars)
  CREDENTIAL_ENC_KEY: z.string().min(32).default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),

  // LLM
  LLM_API_KEY: z.string().default(''),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  LLM_BASE_URL: z.string().default('https://api.openai.com/v1'),

  // Bootstrap admin (seeded on first boot)
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().default('admin@gateway.local'),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(8).default('admin12345678'),

  // WooCommerce MCP server (pre-registered upstream)
  WOO_MCP_URL: z.string().default('http://localhost:4001'),
  WOO_MCP_TOKEN: z.string().default('woo-mcp-bearer-token'),

  // Cookie settings
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.coerce.boolean().default(false),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    console.error(z.prettifyError(result.error));
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
