import { useEffect } from 'react';
import { createIdleLock } from '@/crypto/idle-lock.service.ts';
import { vaultManager } from '@/database/sync/sync.container.ts';

/** Anything that means a person is still there. Passive, so scrolling stays smooth. */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/**
 * Locks the vault when the user walks away.
 *
 * Only runs while the vault is open — there is nothing to lock otherwise, and
 * listeners on the unlock screen would be measuring the wrong thing entirely.
 */
export function useIdleLock(isUnlocked: boolean) {
  useEffect(() => {
    if (!isUnlocked) return;

    const lock = createIdleLock({ onIdle: () => void vaultManager.lock() });
    lock.start();

    const noteActivity = () => lock.noteActivity();
    // A tab coming back into view is the moment to catch a machine that was asleep
    // while its timers were not running.
    const check = () => lock.check();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, noteActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', check);

    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, noteActivity);
      document.removeEventListener('visibilitychange', check);
      lock.stop();
    };
  }, [isUnlocked]);
}
