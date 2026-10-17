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
  LLM_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v ?? '').trim()),
  LLM_MODEL: z.string().default('gpt-oss:120b-cloud'),
  LLM_BASE_URL: z.string().default('http://127.0.0.1:11434/v1'),

  // Bootstrap admin (seeded on first boot)
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().default('admin@gateway.local'),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(8).default('admin12345678'),

  // WooCommerce MCP server (pre-registered upstream)
  WOO_MCP_PORT: z.coerce.number().default(4011),
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

  // Multi-store provisioning (Kind / k3s)
  HELM_BIN: z.string().default('helm'),
  KUBECTL_BIN: z.string().default('kubectl'),
  STORE_CHART_PATH: z.string().default('/charts/store'),
  STORE_HOST_SUFFIX: z.string().default('localtest.me'),
  STORE_INGRESS_CLASS: z.string().default('nginx'),
  STORE_STORAGE_CLASS: z.string().default('standard'),
  STORE_TLS: envBool(false),
  MAX_STORES_PER_USER: z.coerce.number().default(3),
  STORE_PROVISION_TIMEOUT_SEC: z.coerce.number().default(600),
  GATEWAY_NAMESPACE: z.string().default('platform'),
  GATEWAY_SERVICE_ACCOUNT: z.string().default('gateway'),
  WOO_MCP_IMAGE: z.string().default('mcp-woo:local'),
  WORDPRESS_IMAGE: z.string().default('wordpress:6.7.2-php8.2-apache'),
  WORDPRESS_CLI_IMAGE: z.string().default('wordpress:cli-2.11'),
  MARIADB_IMAGE: z.string().default('mariadb:11.4'),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    console.error(z.prettifyError(result.error));
    process.exit(1);
  }
  if (result.data.NODE_ENV === 'production') {
    // Dev defaults above exist so `bun run dev` works out of the box; never ship them.
    const defaults = configSchema.parse({ DATABASE_URL: 'x' });
    const insecure = (
      ['CREDENTIAL_ENC_KEY', 'BOOTSTRAP_ADMIN_PASSWORD', 'WOO_MCP_TOKEN', 'NOTES_MCP_TOKEN'] as const
    ).filter((k) => result.data[k] === defaults[k]);
    if (insecure.length) {
      console.error(`❌ Refusing to start in production with default values for: ${insecure.join(', ')}`);
      process.exit(1);
    }
  }
  return result.data;
}

export const config = loadConfig();
