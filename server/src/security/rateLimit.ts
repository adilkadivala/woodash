/**
 * Minimal in-memory fixed-window rate limiter.
 * Per-process: fine for the single gateway replica; a multi-replica deployment
 * would move the counters to Redis/Postgres.
 */
export class RateLimiter {
  private windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Returns true if the call is allowed, false if over the limit. */
  hit(key: string): boolean {
    if (this.limit <= 0) return true;
    const now = Date.now();
    const w = this.windows.get(key);
    if (!w || now - w.start >= this.windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      if (this.windows.size > 10_000) this.sweep(now);
      return true;
    }
    w.count++;
    return w.count <= this.limit;
  }

  retryAfterSec(key: string): number {
    const w = this.windows.get(key);
    if (!w) return 0;
    return Math.max(0, Math.ceil((w.start + this.windowMs - Date.now()) / 1000));
  }

  private sweep(now: number): void {
    for (const [k, w] of this.windows) {
      if (now - w.start >= this.windowMs) this.windows.delete(k);
    }
  }
}

/** Tool calls per user per minute (MCP and chat share the budget). */
export const toolCallLimiter = new RateLimiter(Number(process.env.TOOL_RATE_LIMIT_PER_MIN ?? 60), 60_000);

/** Login attempts per IP+email per 15 minutes. */
export const loginLimiter = new RateLimiter(Number(process.env.LOGIN_RATE_LIMIT ?? 10), 15 * 60_000);
