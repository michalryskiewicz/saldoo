import { useEffect, useState } from 'react';
import { createRevealDelay, REVEAL_DELAY_MS } from './reveal-delay.service.ts';

/**
 * Whether this wait has lasted long enough to be worth drawing.
 *
 * Mounting is the start of the wait and unmounting is its end, so a loading
 * component that asks this renders nothing at all when the thing it waits for
 * arrives quickly — which is most of the time.
 */
export function useRevealAfterDelay(delayMs: number = REVEAL_DELAY_MS): boolean {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const delay = createRevealDelay({ onReveal: () => setRevealed(true), delayMs });
    delay.start();

    return () => delay.stop();
  }, [delayMs]);

  return revealed;
}
