import crypto from 'node:crypto';
import { prisma } from '../db/client.js';
import type { Principal } from '../auth/principal.js';

/**
 * Write a row to the audit log.
 * Called in the `finally` block of every tool execution.
 */
export interface AuditEntry {
  principal: Principal;
  via: 'mcp' | 'chat' | 'dashboard';
  serverSlug?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  durationMs?: number;
  outcome: 'success' | 'error' | 'denied' | 'timeout';
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Hash tool arguments for audit logging.
 * We never store raw arguments (they may contain PII).
 */
function hashArgs(args?: Record<string, unknown>): string | null {
  if (!args || Object.keys(args).length === 0) return null;
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(args))
    .digest('hex')
    .slice(0, 16); // Short hash is sufficient for identification
}

/**
 * Record an audit log entry.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.principal.userId,
        apiKeyId: entry.principal.apiKeyId ?? null,
        via: entry.via,
        serverSlug: entry.serverSlug ?? null,
        toolName: entry.toolName ?? null,
        argsHash: hashArgs(entry.args),
        durationMs: entry.durationMs ?? null,
        outcome: entry.outcome,
        errorCode: entry.errorCode ?? null,
        errorMessage: entry.errorMessage?.slice(0, 500) ?? null, // Truncate long errors
      },
    });
  } catch (err) {
    // Audit writes must never crash the request
    console.error('[audit] Failed to write audit log:', err);
  }
}
