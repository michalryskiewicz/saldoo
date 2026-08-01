/**
 * Three hundred milliseconds: a wait shorter than this is over before the eye has
 * settled on it, so showing one costs a flash and buys nothing.
 */
export const REVEAL_DELAY_MS = 300;

export interface RevealDelay {
  /** Begins the countdown. Calling it again while counting keeps the original deadline. */
  start(): void;
  /** Abandons the countdown. A wait that ends here was never seen. */
  stop(): void;
}

export type RevealDelayOptions = {
  onReveal: () => void;
  delayMs?: number;
};

/**
 * Holds back a loading state until the wait has earned a place on the screen.
 *
 * The countdown is one-shot: it fires once and then has nothing left to say, so a
 * revealed wait stays revealed until whoever owns it stops caring and calls
 * {@link RevealDelay.stop}.
 */
export function createRevealDelay({
  onReveal,
  delayMs = REVEAL_DELAY_MS,
}: RevealDelayOptions): RevealDelay {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let revealed = false;

  return {
    start() {
      if (revealed || timer !== null) return;

      timer = setTimeout(() => {
        timer = null;
        revealed = true;
        onReveal();
      }, delayMs);
    },

    stop() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      revealed = false;
    },
  };
}
