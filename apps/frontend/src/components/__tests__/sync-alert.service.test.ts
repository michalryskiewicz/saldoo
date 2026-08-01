import { describe, it, expect } from 'vitest';
import { resolveSyncAlert } from '../sync-alert.service.ts';

const healthy = { isOnline: true, isDriveConnected: true, hasFailedPermanently: false };

describe('resolveSyncAlert', () => {
  it('says nothing while everything is reaching Drive', () => {
    expect(resolveSyncAlert(healthy)).toBeNull();
  });

  it('speaks up when the Drive connection is gone, and offers the one thing that fixes it', () => {
    const alert = resolveSyncAlert({ ...healthy, isDriveConnected: false });

    expect(alert).toEqual({
      message: 'sync.alert_disconnected',
      action: 'reconnect',
    });
  });

  it('speaks up when changes were rejected for good', () => {
    const alert = resolveSyncAlert({ ...healthy, hasFailedPermanently: true });

    expect(alert).toEqual({
      message: 'sync.alert_failed',
      action: 'reconnect',
    });
  });

  it('stays quiet offline, even though nothing can reach Drive', () => {
    // The rule worth writing down. Offline is not a stalled session: the records are here,
    // the outbox is holding, and it clears itself. A banner nobody can dismiss and nobody
    // can act on is noise — and "reconnect Drive" is the wrong thing to say to someone who
    // knows they are on a train.
    expect(resolveSyncAlert({ isOnline: false, isDriveConnected: false, hasFailedPermanently: true }))
      .toBeNull();
  });

  it('puts a lost connection ahead of a failed upload, because it explains it', () => {
    const alert = resolveSyncAlert({
      isOnline: true,
      isDriveConnected: false,
      hasFailedPermanently: true,
    });

    expect(alert?.message).toBe('sync.alert_disconnected');
  });
});
