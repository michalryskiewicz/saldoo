/**
 * Fixed-window in-memory rate limiter.
 *
 * Deliberately not a dependency and not shared state: the only endpoint left is a
 * proxy for public NBP rates, and a self-hosted single process needs nothing more
 * than this. Anything distributed would be solving a problem Saldoo does not have.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; windowStartedAt: number }>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** @returns true when the caller may proceed, false when it is over budget. */
  tryConsume(key: string): boolean {
    const timestamp = this.now();
    const existing = this.hits.get(key);

    if (!existing || timestamp - existing.windowStartedAt >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStartedAt: timestamp });
      return true;
    }

    if (existing.count >= this.maxRequests) return false;

    existing.count += 1;
    return true;
  }

  /** Drops windows that have expired, so long-lived processes do not grow forever. */
  prune(): void {
    const timestamp = this.now();

    for (const [key, entry] of this.hits) {
      if (timestamp - entry.windowStartedAt >= this.windowMs) this.hits.delete(key);
    }
  }

  get trackedKeys(): number {
    return this.hits.size;
  }
}
