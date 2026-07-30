import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocumentDb } from '../document-db.ts';
import { createIndexedDbOutboxStore } from '../outbox-store.ts';
import { createOutbox, type Uploader } from '../outbox.ts';

/** A controllable clock and scheduler, so backoff is asserted rather than waited out. */
function fakeScheduler() {
  const pending: { at: number; run: () => void }[] = [];
  let now = 0;

  return {
    now: () => now,
    schedule: (delay: number, run: () => void) => {
      pending.push({ at: now + delay, run });
    },
    /** Advances time and runs everything due, the way a real timer would. */
    async advance(by: number) {
      now += by;
      const due = pending.filter((p) => p.at <= now);
      for (const p of due) pending.splice(pending.indexOf(p), 1);
      for (const p of due) p.run();
      await Promise.resolve();
      await Promise.resolve();
    },
    scheduledDelays: () => pending.map((p) => p.at - now),
  };
}

function build(uploader: Uploader, name = `outbox-${Math.random()}`) {
  const scheduler = fakeScheduler();
  const outbox = createOutbox({
    store: createIndexedDbOutboxStore(createDocumentDb(name)),
    upload: uploader,
    schedule: scheduler.schedule,
  });

  return { outbox, scheduler, name };
}

describe('outbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns from a write without waiting for the upload', () => {
    // A promise that never settles: if markDirty awaited the upload, this test would
    // hang. Being synchronous by contract is what lets a mutator report success
    // while offline.
    const upload = vi.fn(() => new Promise<void>(() => {}));
    const { outbox } = build(upload);

    outbox.markDirty();

    expect(outbox.state().pending).toBe(true);
    expect(upload).not.toHaveBeenCalled();
  });

  it('coalesces a burst of changes into one upload', async () => {
    const upload = vi.fn(async () => {});
    const { outbox, scheduler } = build(upload);

    outbox.markDirty();
    outbox.markDirty();
    outbox.markDirty();
    await scheduler.advance(10_000);

    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('clears pending once the upload lands', async () => {
    const upload = vi.fn(async () => {});
    const { outbox, scheduler } = build(upload);

    outbox.markDirty();
    await scheduler.advance(10_000);

    expect(outbox.state().pending).toBe(false);
    expect(outbox.state().failure).toBeUndefined();
  });

  it('retries a transient failure with a growing delay', async () => {
    const upload = vi.fn(async () => {
      throw Object.assign(new Error('offline'), { transient: true });
    });
    const { outbox, scheduler } = build(upload);

    outbox.markDirty();
    await scheduler.advance(10_000);
    const [firstRetry] = scheduler.scheduledDelays();

    await scheduler.advance(firstRetry);
    const [secondRetry] = scheduler.scheduledDelays();

    expect(upload).toHaveBeenCalledTimes(2);
    expect(secondRetry).toBeGreaterThan(firstRetry);
    expect(outbox.state().pending).toBe(true);
    expect(outbox.state().failure).toBe('transient');
  });

  it('keeps retrying a rate limit rather than giving up on it', async () => {
    const upload = vi.fn(async () => {
      throw Object.assign(new Error('rate limited'), { transient: true, status: 429 });
    });
    const { outbox, scheduler } = build(upload);

    outbox.markDirty();
    await scheduler.advance(10_000);

    expect(outbox.state().failure).toBe('transient');
    expect(scheduler.scheduledDelays().length).toBeGreaterThan(0);
  });

  it('stops retrying a permanent failure and says so', async () => {
    const upload = vi.fn(async () => {
      throw Object.assign(new Error('the backup is unreadable'), { transient: false });
    });
    const { outbox, scheduler } = build(upload);

    outbox.markDirty();
    await scheduler.advance(10_000);

    expect(outbox.state().failure).toBe('permanent');
    // Nothing scheduled: retrying would hammer Drive for a failure that cannot clear
    // itself, and the user has to act.
    expect(scheduler.scheduledDelays()).toHaveLength(0);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('does not lose the pending state across a reload', async () => {
    const upload = vi.fn(async () => {
      throw Object.assign(new Error('offline'), { transient: true });
    });
    const { outbox, scheduler, name } = build(upload);

    outbox.markDirty();
    await scheduler.advance(10_000);
    expect(outbox.state().pending).toBe(true);

    // A fresh outbox on the same database is what a reload looks like.
    const reloaded = build(vi.fn(async () => {}), name);
    await reloaded.outbox.restore();

    expect(reloaded.outbox.state().pending).toBe(true);
  });

  it('uploads the restored work after a reload', async () => {
    const failing = vi.fn(async () => {
      throw Object.assign(new Error('offline'), { transient: true });
    });
    const { outbox, scheduler, name } = build(failing);
    outbox.markDirty();
    await scheduler.advance(10_000);

    const upload = vi.fn(async () => {});
    const reloaded = build(upload, name);
    await reloaded.outbox.restore();
    await reloaded.scheduler.advance(10_000);

    expect(upload).toHaveBeenCalledTimes(1);
    expect(reloaded.outbox.state().pending).toBe(false);
  });

  it('runs one upload at a time even when changes arrive mid-flight', async () => {
    let inFlight = 0;
    let peak = 0;
    const upload = vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
    });
    const { outbox, scheduler } = build(upload);

    outbox.markDirty();
    await scheduler.advance(10_000);
    outbox.markDirty();
    await scheduler.advance(10_000);

    expect(peak).toBe(1);
  });

  it('tells subscribers when the state changes, so the indicator can follow', async () => {
    const upload = vi.fn(async () => {});
    const { outbox, scheduler } = build(upload);
    const seen: boolean[] = [];
    outbox.subscribe(() => seen.push(outbox.state().pending));

    outbox.markDirty();
    await scheduler.advance(10_000);

    expect(seen).toContain(true);
    expect(seen).toContain(false);
  });
});
