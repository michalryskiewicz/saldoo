import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../rate-limiter.ts';

const WINDOW = 60_000;

function atTime() {
  let current = 1_000_000;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe('RateLimiter', () => {
  it('allows requests up to the limit', () => {
    const clock = atTime();
    const limiter = new RateLimiter(3, WINDOW, clock.now);

    expect([limiter.tryConsume('ip'), limiter.tryConsume('ip'), limiter.tryConsume('ip')]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('refuses the request that goes over the limit', () => {
    const clock = atTime();
    const limiter = new RateLimiter(2, WINDOW, clock.now);

    limiter.tryConsume('ip');
    limiter.tryConsume('ip');

    expect(limiter.tryConsume('ip')).toBe(false);
  });

  it('keeps refusing while the window is still open', () => {
    const clock = atTime();
    const limiter = new RateLimiter(1, WINDOW, clock.now);
    limiter.tryConsume('ip');

    clock.advance(WINDOW - 1);

    expect(limiter.tryConsume('ip')).toBe(false);
  });

  it('opens a fresh window once the old one has elapsed', () => {
    const clock = atTime();
    const limiter = new RateLimiter(1, WINDOW, clock.now);
    limiter.tryConsume('ip');

    clock.advance(WINDOW);

    expect(limiter.tryConsume('ip')).toBe(true);
  });

  it('budgets each caller separately', () => {
    const clock = atTime();
    const limiter = new RateLimiter(1, WINDOW, clock.now);

    limiter.tryConsume('first');

    expect(limiter.tryConsume('second')).toBe(true);
  });

  it('does not let one caller exhaust another’s budget', () => {
    const clock = atTime();
    const limiter = new RateLimiter(1, WINDOW, clock.now);

    limiter.tryConsume('first');
    limiter.tryConsume('second');

    expect(limiter.tryConsume('first')).toBe(false);
  });

  it('forgets callers whose window has expired', () => {
    const clock = atTime();
    const limiter = new RateLimiter(1, WINDOW, clock.now);
    limiter.tryConsume('ip');

    clock.advance(WINDOW);
    limiter.prune();

    expect(limiter.trackedKeys).toBe(0);
  });

  it('keeps callers whose window is still open when pruning', () => {
    const clock = atTime();
    const limiter = new RateLimiter(1, WINDOW, clock.now);
    limiter.tryConsume('ip');

    clock.advance(WINDOW - 1);
    limiter.prune();

    expect(limiter.trackedKeys).toBe(1);
  });
});
