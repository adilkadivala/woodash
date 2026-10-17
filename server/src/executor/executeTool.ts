import type { Principal } from '../auth/principal.js';
import { decodeToolName } from '../aggregator/naming.js';
import { checkPolicy } from '../policy/engine.js';
import { writeAuditLog } from '../audit/audit.js';
import type { UpstreamManager } from '../upstream/manager.js';

/**
 * Result of a tool execution.
 */
export interface ToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

/**
 * THE single call path for all tool executions.
 *
 * Both the MCP endpoint and the chat agent call ONLY this function.
 * This ensures revocation, disable, dead-upstream isolation, policy,
 * and audit attribution are enforced in exactly one place.
 */
export async function executeTool(
  manager: UpstreamManager,
  principal: Principal,
  namespacedName: string,
  args: Record<string, unknown>,
  opts: { via: 'mcp' | 'chat' | 'dashboard' },
): Promise<ToolResult> {
  const startTime = Date.now();
  let serverSlug: string | undefined;
  let toolName: string | undefined;

  try {
    // 1. Decode "woo__list_orders" -> { slug: 'woo', tool: 'list_orders' }
    const decoded = decodeToolName(namespacedName);
    if (!decoded) {
      await writeAuditLog({
        principal,
        via: opts.via,
        toolName: namespacedName,
        outcome: 'error',
        errorCode: 'INVALID_TOOL_NAME',
        errorMessage: `Invalid tool name format: ${namespacedName}`,
        durationMs: Date.now() - startTime,
      });
      return {
        content: [{ type: 'text', text: `Invalid tool name: "${namespacedName}". Expected format: server__tool` }],
        isError: true,
      };
    }

    serverSlug = decoded.slug;
    toolName = decoded.tool;

    // 2. Server exists? Enabled? Breaker closed?
    const client = manager.getClient(serverSlug);
    if (!client) {
      await writeAuditLog({
        principal,
        via: opts.via,
        serverSlug,
        toolName,
        args,
        outcome: 'error',
        errorCode: 'SERVER_NOT_FOUND',
        errorMessage: `Server "${serverSlug}" not found or disabled`,
        durationMs: Date.now() - startTime,
      });
      return {
        content: [{ type: 'text', text: `Server "${serverSlug}" is not available. It may be disabled or removed.` }],
        isError: true,
      };
    }

    // Check circuit breaker
    const breaker = manager.getBreaker(serverSlug);
    if (breaker.isOpen()) {
      await writeAuditLog({
        principal,
        via: opts.via,
        serverSlug,
        toolName,
        args,
        outcome: 'error',
        errorCode: 'UPSTREAM_UNREACHABLE',
        errorMessage: `Server "${serverSlug}" circuit breaker is open (too many recent failures)`,
        durationMs: Date.now() - startTime,
      });
      return {
        content: [{ type: 'text', text: `Server "${serverSlug}" is temporarily unavailable due to repeated failures. Try again later.` }],
        isError: true,
      };
    }

    // 3. Policy check
    const decision = await checkPolicy(principal, serverSlug, toolName);
    if (decision === 'deny') {
      await writeAuditLog({
        principal,
        via: opts.via,
        serverSlug,
        toolName,
        args,
        outcome: 'denied',
        errorCode: 'POLICY_DENIED',
        errorMessage: `Tool "${namespacedName}" denied by policy for role "${principal.role}"`,
        durationMs: Date.now() - startTime,
      });
      return {
        content: [{ type: 'text', text: `Access denied: you don't have permission to use "${namespacedName}".` }],
        isError: true,
      };
    }

    // 4. Call upstream with timeout (reconnect lazily if the health loop dropped the session)
    if (!client.isConnected()) await client.connect();
    const result = await callWithTimeout(client, toolName, args, 15_000);

    // Record breaker success
    breaker.recordSuccess();

    // 5. Audit success
    await writeAuditLog({
      principal,
      via: opts.via,
      serverSlug,
      toolName,
      args,
      outcome: 'success',
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const isTimeout = error instanceof Error && /time(d)? ?out/i.test(error.message);
    const outcome = isTimeout ? 'timeout' : 'error';
    const errorCode = isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR';
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Record breaker failure
    if (serverSlug) {
      const breaker = manager.getBreaker(serverSlug);
      breaker.recordFailure();
    }

    // Audit the failure
    await writeAuditLog({
      principal,
      via: opts.via,
      serverSlug,
      toolName,
      args,
      outcome,
      errorCode,
      errorMessage,
      durationMs,
    });

    return {
      content: [{ type: 'text', text: `Error calling "${namespacedName}": ${errorMessage}` }],
      isError: true,
    };
  }
}

/**
 * Call an upstream tool with a timeout.
 */
async function callWithTimeout(
  client: { callTool(name: string, args: Record<string, unknown>, timeoutMs?: number): Promise<ToolResult> },
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs: number,
): Promise<ToolResult> {
  return new Promise<ToolResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Tool call timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    client
      .callTool(toolName, args, timeoutMs)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
