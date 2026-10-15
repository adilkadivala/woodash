import { z } from 'zod/v4';
import dotenv from 'dotenv';

dotenv.config();

/** Parse env booleans correctly (`"false"` must not become true). */
function envBool(defaultValue: boolean) {
  return z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined) return defaultValue;
      if (typeof v === 'boolean') return v;
      const s = v.trim().toLowerCase();
      if (s === 'true' || s === '1' || s === 'yes') return true;
      if (s === 'false' || s === '0' || s === 'no' || s === '') return false;
      return defaultValue;
    });
}

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

  // LLM (OpenRouter by default; any OpenAI-compatible /v1 works)
  LLM_API_KEY: z.string().default(''),
  LLM_MODEL: z.string().default('openai/gpt-4o-mini'),
  LLM_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),

  // Bootstrap admin (seeded on first boot)
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().default('admin@gateway.local'),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(8).default('admin12345678'),

  // WooCommerce MCP server (pre-registered upstream)
  WOO_MCP_URL: z.string().default('http://127.0.0.1:4011/mcp'),
  WOO_MCP_TOKEN: z.string().default('woo-mcp-bearer-token'),

  UTILS_MCP_URL: z.string().default('http://127.0.0.1:4002/mcp'),
  NOTES_MCP_URL: z.string().default('http://127.0.0.1:4003/mcp'),
  NOTES_MCP_TOKEN: z.string().default('notes-mcp-bearer-token'),

  /** Allow http://127.0.0.1 / localhost upstream URLs when registering servers (local dev). */
  SSRF_ALLOW_LOCALHOST: envBool(true),

  // Cookie settings
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: envBool(false),

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
