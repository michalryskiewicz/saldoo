import type { TranslationKey } from '@/i18n.ts';

export type SyncAlert = {
  message: TranslationKey;
  /** The one thing that fixes it. `null` would mean telling someone about a wall. */
  action: 'reconnect';
};

export type SyncAlertState = {
  isOnline: boolean;
  isDriveConnected: boolean;
  hasFailedPermanently: boolean;
};

/**
 * Whether the app owes the user a sentence about sync, rather than an icon.
 *
 * The Drive mark in the header carries every ordinary state, and that is enough while
 * things work. It is not enough for the one case that looks identical to working: changes
 * piling up locally because nothing can reach Drive. That state used to be a small red
 * glyph, easy to work an hour past.
 *
 * **Offline says nothing on purpose.** It is not a stalled session — the records are on
 * this device, the outbox is holding them, and it clears by itself when the network
 * returns. A banner that cannot be dismissed and cannot be acted on is noise, and
 * "reconnect Drive" is the wrong thing to say to someone who knows they are on a train.
 *
 * Signing anybody out is not among the outcomes. Only Google withdrawing access ends a
 * session; being unable to reach Drive must never cost someone their own records.
 */
export function resolveSyncAlert({
  isOnline,
  isDriveConnected,
  hasFailedPermanently,
}: SyncAlertState): SyncAlert | null {
  if (!isOnline) return null;

  // Ahead of a failed upload because it explains it: uploads fail *because* the
  // connection went, and naming the cause is the only message worth acting on.
  if (!isDriveConnected) return { message: 'sync.alert_disconnected', action: 'reconnect' };

  if (hasFailedPermanently) return { message: 'sync.alert_failed', action: 'reconnect' };

  return null;
}
