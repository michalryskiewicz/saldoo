import { describe, expect, it } from 'vitest';
import { resolveSyncPresentation } from '../sync-status-presentation.service.ts';

const healthy = {
  status: 'synced' as const,
  isPending: false,
  hasFailedPermanently: false,
  isDriveConnected: true,
};

describe('resolveSyncPresentation', () => {
  it('stays quiet when Drive has everything', () => {
    const presentation = resolveSyncPresentation(healthy);

    expect(presentation.label).toBe('sync.synced');
    expect(presentation.tone).toBe('positive');
    expect(presentation.isBusy).toBeFalsy();
  });

  it('spins while a sync is running', () => {
    expect(resolveSyncPresentation({ ...healthy, status: 'syncing' }).isBusy).toBe(true);
  });

  it('spins while a change has not left the device', () => {
    const presentation = resolveSyncPresentation({ ...healthy, isPending: true });

    expect(presentation.label).toBe('sync.pending');
    expect(presentation.isBusy).toBe(true);
  });

  it('puts an unsent change ahead of how the last sync went', () => {
    // The change is the user's own and it is the thing they would want to know. "Synced"
    // beside a change still sitting here is the disagreement this function exists to settle.
    expect(resolveSyncPresentation({ ...healthy, isPending: true }).label).toBe('sync.pending');
  });

  it('puts a permanent failure ahead of a pending change', () => {
    const presentation = resolveSyncPresentation({
      ...healthy,
      isPending: true,
      hasFailedPermanently: true,
    });

    expect(presentation.label).toBe('sync.upload_failed');
    expect(presentation.tone).toBe('destructive');
  });

  it('puts a lost Drive connection ahead of everything', () => {
    // Nothing else can make progress until it returns, so it outranks even a failed upload.
    const presentation = resolveSyncPresentation({
      status: 'blocked',
      isPending: true,
      hasFailedPermanently: true,
      isDriveConnected: false,
    });

    expect(presentation.label).toBe('metrics.need_to_sync_with_google_drive');
    expect(presentation.tone).toBe('destructive');
  });

  it('reports offline without calling it a problem', () => {
    // The data and the key are already here. Colouring this destructive would tell the user
    // something is broken when nothing is.
    const presentation = resolveSyncPresentation({ ...healthy, status: 'offline' });

    expect(presentation.label).toBe('sync.offline');
    // Muted, not destructive and not positive: nothing is broken and nothing is confirmed.
    expect(presentation.tone).toBe('muted');
  });

  it('marks a halted sync as a problem', () => {
    expect(resolveSyncPresentation({ ...healthy, status: 'blocked' }).tone).toBe('destructive');
  });
});
