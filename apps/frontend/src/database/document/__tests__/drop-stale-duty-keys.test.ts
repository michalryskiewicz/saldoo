import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/database/index.ts';
import { dropStaleDutyKeys } from '../drop-stale-duty-keys.ts';

const duty = (id: string, hash: string) => ({
  id,
  hash,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  executionDate: new Date('2026-02-01T00:00:00.000Z'),
});

describe('drop stale duty keys', () => {
  beforeEach(async () => {
    await db.duties.clear();
  });

  it('removes rows still keyed by their old uuid', async () => {
    await db.duties.bulkPut([duty('uuid-1', 'hash-1'), duty('uuid-2', 'hash-2')]);

    expect(await dropStaleDutyKeys(db)).toBe(2);
    expect(await db.duties.count()).toBe(0);
  });

  it('leaves rows that are already keyed by their hash', async () => {
    await db.duties.bulkPut([duty('hash-1', 'hash-1')]);

    expect(await dropStaleDutyKeys(db)).toBe(0);
    expect(await db.duties.count()).toBe(1);
  });

  it('frees the unique index so the hash-keyed row can be written', async () => {
    // This is the failure it exists for: with the uuid row still present, writing the
    // same duty under its hash trips the unique index on `hash` and every duty in the
    // batch fails together.
    await db.duties.put(duty('uuid-1', 'hash-1'));

    await dropStaleDutyKeys(db);

    await expect(db.duties.bulkPut([duty('hash-1', 'hash-1')])).resolves.toBeDefined();
    expect((await db.duties.toArray()).map((d) => d.id)).toEqual(['hash-1']);
  });

  it('does nothing on a device with no duties at all', async () => {
    expect(await dropStaleDutyKeys(db)).toBe(0);
  });

  it('is safe to run again — it is not a one-time migration', async () => {
    await db.duties.put(duty('uuid-1', 'hash-1'));

    expect(await dropStaleDutyKeys(db)).toBe(1);
    expect(await dropStaleDutyKeys(db)).toBe(0);
  });
});
