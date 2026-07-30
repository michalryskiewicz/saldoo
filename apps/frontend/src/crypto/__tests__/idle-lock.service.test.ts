import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createIdleLock, IDLE_TIMEOUT_MS } from '../idle-lock.service.ts';

function build(timeoutMs = IDLE_TIMEOUT_MS) {
  let clock = 0;
  const onIdle = vi.fn();
  const lock = createIdleLock({ onIdle, timeoutMs, now: () => clock });

  return {
    onIdle,
    lock,
    advance(ms: number) {
      clock += ms;
      vi.advanceTimersByTime(ms);
    },
    /** Time passing with no timer firing — a suspended laptop, a throttled tab. */
    skip(ms: number) {
      clock += ms;
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createIdleLock', () => {
  it('locks once the idle timeout passes', () => {
    const { lock, onIdle, advance } = build(30_000);
    lock.start();

    advance(30_000);

    expect(onIdle).toHaveBeenCalledOnce();
  });

  it('does not lock before the timeout', () => {
    const { lock, onIdle, advance } = build(30_000);
    lock.start();

    advance(29_999);

    expect(onIdle).not.toHaveBeenCalled();
  });

  it('starts the countdown again on activity', () => {
    const { lock, onIdle, advance } = build(30_000);
    lock.start();

    advance(20_000);
    lock.noteActivity();
    advance(20_000);

    expect(onIdle).not.toHaveBeenCalled();
  });

  it('locks 30 minutes after the last activity, not after the first', () => {
    const { lock, onIdle, advance } = build(30_000);
    lock.start();

    advance(20_000);
    lock.noteActivity();
    advance(30_000);

    expect(onIdle).toHaveBeenCalledOnce();
  });

  it('locks a device that was asleep past the timeout, on the next check', () => {
    // A suspended machine does not run timers. Waking up to an unlocked vault
    // because no callback fired is exactly the case this has to cover, so idleness
    // is judged on the clock rather than on the timer having run.
    const { lock, onIdle, skip } = build(30_000);
    lock.start();

    skip(60 * 60_000);
    lock.check();

    expect(onIdle).toHaveBeenCalledOnce();
  });

  it('leaves a vault alone when the check lands inside the window', () => {
    const { lock, onIdle, skip } = build(30_000);
    lock.start();

    skip(10_000);
    lock.check();

    expect(onIdle).not.toHaveBeenCalled();
  });

  it('locks only once, however many times it is asked', () => {
    const { lock, onIdle, advance, skip } = build(30_000);
    lock.start();

    advance(30_000);
    skip(30_000);
    lock.check();

    expect(onIdle).toHaveBeenCalledOnce();
  });

  it('stops locking once stopped', () => {
    const { lock, onIdle, advance } = build(30_000);
    lock.start();

    lock.stop();
    advance(60_000);

    expect(onIdle).not.toHaveBeenCalled();
  });

  it('ignores activity reported after it stopped', () => {
    const { lock, onIdle, advance } = build(30_000);
    lock.start();
    lock.stop();

    lock.noteActivity();
    advance(60_000);

    expect(onIdle).not.toHaveBeenCalled();
  });

  it('defaults to the thirty minutes the product decided on', () => {
    expect(IDLE_TIMEOUT_MS).toBe(30 * 60_000);
  });
});
