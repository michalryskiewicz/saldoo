import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRevealDelay, REVEAL_DELAY_MS } from '../reveal-delay.service.ts';

function build(delayMs = REVEAL_DELAY_MS) {
  const onReveal = vi.fn();

  return { onReveal, delay: createRevealDelay({ onReveal, delayMs }) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createRevealDelay', () => {
  it('reveals once the delay has passed', () => {
    const { delay, onReveal } = build(300);
    delay.start();

    vi.advanceTimersByTime(300);

    expect(onReveal).toHaveBeenCalledOnce();
  });

  it('reveals nothing while the wait is still short', () => {
    const { delay, onReveal } = build(300);
    delay.start();

    vi.advanceTimersByTime(299);

    expect(onReveal).not.toHaveBeenCalled();
  });

  it('reveals nothing when the wait ends before the delay', () => {
    const { delay, onReveal } = build(300);
    delay.start();

    vi.advanceTimersByTime(299);
    delay.stop();
    vi.advanceTimersByTime(1000);

    expect(onReveal).not.toHaveBeenCalled();
  });

  it('keeps the original deadline when start is called again', () => {
    const { delay, onReveal } = build(300);
    delay.start();

    vi.advanceTimersByTime(200);
    delay.start();
    vi.advanceTimersByTime(100);

    expect(onReveal).toHaveBeenCalledOnce();
  });

  it('reveals at most once', () => {
    const { delay, onReveal } = build(300);
    delay.start();

    vi.advanceTimersByTime(3000);

    expect(onReveal).toHaveBeenCalledOnce();
  });

  it('defaults to a delay short enough to stay unnoticed', () => {
    expect(REVEAL_DELAY_MS).toBeLessThanOrEqual(400);
  });
});
