import type { BrowserContext, Page } from '@playwright/test';

/**
 * Puts a database of the **old** shape on disk before the app has ever run.
 *
 * This is the manual checklist item with the worst consequence if it is wrong and the one
 * a human is least likely to re-run: an upgrade that drops a store takes the user's
 * records with it, and it can only happen on a browser that already holds the old shape.
 * A fresh install never exercises it, so nothing short of seeding reaches this path.
 */

/** Version 1 of `AppDB`, before tags (v2) and before settings (v3). */
const VERSION_1_STORES = {
  expenses: {
    keyPath: 'id',
    indexes: [
      'createdAt',
      'updatedAt',
      'userId',
      'description',
      'expense',
      'currency',
      'severity',
      'frequency',
      'execution',
      'strategyPart',
      'tagId',
    ],
  },
  profits: {
    keyPath: 'id',
    indexes: [
      'createdAt',
      'updatedAt',
      'userId',
      'description',
      'profit',
      'currency',
      'frequency',
      'execution',
    ],
  },
  duties: {
    keyPath: 'id',
    indexes: [
      'createdAt',
      'updatedAt',
      'resolved',
      'ignored',
      'frequency',
      'executionDate',
      'expenseId',
      'transactionId',
    ],
    unique: ['hash'],
  },
  transactions: {
    keyPath: 'id',
    indexes: [
      'createdAt',
      'updatedAt',
      'transactionId',
      'sourceBank',
      'amount',
      'currency',
      'transactionDate',
      'description',
      'expenseId',
      'strategyPart',
      'tagId',
      'duties',
    ],
    unique: ['hash'],
  },
  meta: { keyPath: 'key', indexes: [] },
} as const;

/**
 * A page on the app's own origin that runs none of the app.
 *
 * IndexedDB is per-origin, so the seed has to happen there; loading the real app first
 * would let it open the database at the current version and there would be no old shape
 * left to upgrade.
 */
export const SEED_PATH = '/__seed';

export async function serveSeedPage(context: BrowserContext): Promise<void> {
  // Registered after the CSP route so it wins: Playwright tries handlers most-recent
  // first, and the SPA fallback would otherwise answer this path with the whole app.
  await context.route(
    (url) => url.pathname === SEED_PATH,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>seed</title><p>seeding</p>',
      })
  );
}

export type LegacyRows = {
  expenses?: Record<string, unknown>[];
};

export async function seedLegacyDatabase(page: Page, rows: LegacyRows): Promise<void> {
  await page.goto(SEED_PATH);

  await page.evaluate(
    async ({ stores, rows }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('saldoo', 1);

        request.onupgradeneeded = () => {
          const database = request.result;

          for (const [name, spec] of Object.entries(stores)) {
            const store = database.createObjectStore(name, { keyPath: spec.keyPath });
            for (const index of spec.indexes) store.createIndex(index, index);
            for (const index of (spec as { unique?: string[] }).unique ?? []) {
              store.createIndex(index, index, { unique: true });
            }
          }
        };

        request.onsuccess = () => {
          const database = request.result;
          const names = Object.keys(rows) as (keyof typeof rows)[];
          if (!names.length) {
            database.close();
            return resolve();
          }

          const transaction = database.transaction(names as string[], 'readwrite');
          for (const name of names) {
            for (const row of rows[name] ?? []) transaction.objectStore(name).put(row);
          }

          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };

        request.onerror = () => reject(request.error);
      });
    },
    { stores: VERSION_1_STORES, rows }
  );
}
