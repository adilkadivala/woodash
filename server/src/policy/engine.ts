import { prisma } from '../db/client.js';
import type { Principal } from '../auth/principal.js';

/**
 * Tool policy engine.
 * Evaluates whether a principal is allowed to call a specific tool.
 *
 * Rules:
 * - Admin: allowed by default unless explicitly denied
 * - Member: denied by default unless explicitly allowed
 * - Deny always beats allow
 */

export type PolicyDecision = 'allow' | 'deny';

/**
 * Check if a principal is allowed to call a tool on a given server.
 */
export async function checkPolicy(
  principal: Principal,
  serverSlug: string,
  toolName: string,
): Promise<PolicyDecision> {
  // Load matching policies from DB (most specific first)
  const policies = await prisma.toolPolicy.findMany({
    where: {
      role: principal.role,
      OR: [
        { serverSlug: '*' },
        { serverSlug: serverSlug },
      ],
    },
  });

  // If no policies exist, use role-based defaults
  if (policies.length === 0) {
    return principal.role === 'admin' ? 'allow' : 'allow'; // Default allow for all roles when no policies configured
  }

  let hasMatchingAllow = false;
  let hasMatchingDeny = false;

  for (const policy of policies) {
    const matchesServer = policy.serverSlug === '*' || policy.serverSlug === serverSlug;
    const matchesTool = matchesToolPattern(policy.toolPattern, toolName);

    if (matchesServer && matchesTool) {
      if (policy.effect === 'deny') {
        hasMatchingDeny = true;
      } else if (policy.effect === 'allow') {
        hasMatchingAllow = true;
      }
    }
  }

  // Deny beats allow
  if (hasMatchingDeny) return 'deny';
  if (hasMatchingAllow) return 'allow';

  // Fallback defaults: admin=allow, member=deny
  return principal.role === 'admin' ? 'allow' : 'deny';
}

/**
 * Simple glob pattern matching for tool names.
 * Supports '*' as wildcard.
 */
function matchesToolPattern(pattern: string, toolName: string): boolean {
  if (pattern === '*') return true;

  // Convert glob to regex: escape special chars, replace * with .*
  const regexStr = '^' + pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*') + '$';

  return new RegExp(regexStr).test(toolName);
}
