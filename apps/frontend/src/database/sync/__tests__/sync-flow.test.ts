import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/database/index.ts';
import { setLastUpdated, getLastUpdated } from '@/database/meta.ts';
import { exportDB, importInto } from 'dexie-export-import';

describe('Sync Flow Integration', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.expenses.clear();
    await db.profits.clear();
    await db.meta.clear();
  });

  afterEach(async () => {
    await db.expenses.clear();
    await db.profits.clear();
    await db.meta.clear();
  });

  it('should return -1 for lastUpdated when meta table is empty', async () => {
    const lastUpdated = await getLastUpdated();
    expect(lastUpdated).toBe(-1);
  });

  it('should set and retrieve lastUpdated timestamp', async () => {
    const beforeTimestamp = Date.now();
    await setLastUpdated();
    const afterTimestamp = Date.now();

    const lastUpdated = await getLastUpdated();
    expect(lastUpdated).toBeGreaterThanOrEqual(beforeTimestamp);
    expect(lastUpdated).toBeLessThanOrEqual(afterTimestamp);
  });

  it('should preserve lastUpdated timestamp after export and import', async () => {
    // Set initial timestamp
    const initialTimestamp = 1732800000000;
    await db.meta.put({ key: 'lastUpdated', value: initialTimestamp });

    // Add some test data
    await db.expenses.add({
      id: 'test-1',
      createdAt: new Date(),
      description: 'Test expense',
      expense: 100,
      currency: 'PLN',
      severity: null,
    });

    // Export database
    const exportedBlob = await exportDB(db);

    // Clear database
    await db.expenses.clear();
    await db.meta.clear();

    // Verify database is empty
    expect(await getLastUpdated()).toBe(-1);
    expect(await db.expenses.count()).toBe(0);

    // Import database
    await importInto(db, exportedBlob, { overwriteValues: true });

    // Verify data and timestamp are restored
    const restoredTimestamp = await getLastUpdated();
    expect(restoredTimestamp).toBe(initialTimestamp);
    expect(await db.expenses.count()).toBe(1);

    const expense = await db.expenses.get('test-1');
    expect(expense?.description).toBe('Test expense');
  });

  it('should update lastUpdated timestamp when modified', async () => {
    // Set initial timestamp
    await db.meta.put({ key: 'lastUpdated', value: 1000000 });
    const initialTimestamp = await getLastUpdated();
    expect(initialTimestamp).toBe(1000000);

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Update timestamp
    await setLastUpdated();
    const newTimestamp = await getLastUpdated();

    expect(newTimestamp).toBeGreaterThan(initialTimestamp);
  });

  it('should handle multiple exports and imports maintaining timestamp integrity', async () => {
    // First device: add data and set timestamp
    const device1Timestamp = Date.now();
    await db.meta.put({ key: 'lastUpdated', value: device1Timestamp });
    await db.expenses.add({
      id: 'expense-1',
      createdAt: new Date(),
      description: 'Device 1 expense',
      expense: 100,
      currency: 'PLN',
      severity: null,
    });

    // Export from device 1
    const export1 = await exportDB(db);

    // Simulate device 2: clear and import
    await db.expenses.clear();
    await db.meta.clear();
    await importInto(db, export1, { overwriteValues: true });

    // Verify timestamp is preserved
    const device2InitialTimestamp = await getLastUpdated();
    expect(device2InitialTimestamp).toBe(device1Timestamp);

    // Device 2: modify data
    await new Promise((resolve) => setTimeout(resolve, 10));
    const device2Timestamp = Date.now();
    await db.meta.put({ key: 'lastUpdated', value: device2Timestamp });
    await db.expenses.add({
      id: 'expense-2',
      createdAt: new Date(),
      description: 'Device 2 expense',
      expense: 200,
      currency: 'PLN',
      severity: null,
    });

    // Export from device 2
    const export2 = await exportDB(db);

    // Simulate device 1: import newer data
    await db.expenses.clear();
    await db.meta.clear();
    // Re-import device 1 state
    await importInto(db, export1, { overwriteValues: true });

    // Now import device 2 (newer) state
    await importInto(db, export2, { overwriteValues: true });

    // Verify device 1 now has device 2's timestamp and data
    const finalTimestamp = await getLastUpdated();
    expect(finalTimestamp).toBe(device2Timestamp);
    expect(await db.expenses.count()).toBe(2);
  });
});
