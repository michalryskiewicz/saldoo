/** Thirty minutes: long enough not to interrupt work, short enough that a walked-away-from laptop is not an open book. */
export const IDLE_TIMEOUT_MS = 30 * 60_000;

export interface IdleLock {
  start(): void;
  stop(): void;
  /** Restarts the countdown. Cheap enough to call on every pointer move. */
  noteActivity(): void;
  /** Locks if the deadline has already passed. Safe to call at any time. */
  check(): void;
}

export type IdleLockOptions = {
  onIdle: () => void;
  timeoutMs?: number;
  now?: () => number;
};

/**
 * Locks the vault after a stretch of inactivity.
 *
 * Idleness is decided by the clock, not by a timer having fired. A suspended laptop
 * runs no timers and a background tab has its throttled, so a timer alone would let
 * a machine wake up hours later with the vault still open — {@link IdleLock.check}
 * exists to be called on wake and on tab focus, and it catches exactly that.
 */
export function createIdleLock({
  onIdle,
  timeoutMs = IDLE_TIMEOUT_MS,
  now = Date.now,
}: IdleLockOptions): IdleLock {
  let deadline: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const lock = () => {
    if (deadline === null) return;

    deadline = null;
    clearTimer();
    onIdle();
  };

  const arm = () => {
    clearTimer();
    deadline = now() + timeoutMs;
    timer = setTimeout(lock, timeoutMs);
  };

  return {
    start: arm,

    stop() {
      deadline = null;
      clearTimer();
    },

    noteActivity() {
      if (deadline === null) return;

      arm();
    },

    check() {
      if (deadline === null) return;
      if (now() < deadline) return;

      lock();
    },
  };
}
