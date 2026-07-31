import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addDBExpense, updateDBExpense } from '../expenses.ts';
import { documentSession } from '../document/document.container.ts';
import type { ExpenseCreateType } from '@/features/expenses/components/expenses-create.tsx';

vi.mock('../document/document.container.ts', () => ({
  documentSession: { put: vi.fn(), update: vi.fn() },
}));
vi.mock('../document/outbox.container.ts', () => ({ outbox: { markDirty: vi.fn() } }));
vi.mock('../meta.ts', () => ({ setLastUpdated: vi.fn() }));
vi.mock('sonner', () => ({ toast: vi.fn() }));

const anExpense = {
  description: 'Czynsz',
  expense: 2500,
  currency: 'PLN',
  severity: 'MEDIUM',
  frequency: 'WEEKLY',
  execution: new Date('2026-07-15T00:00:00.000Z'),
  tagId: 't1',
  strategyPart: 'NEEDS',
} as unknown as ExpenseCreateType;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addDBExpense', () => {
  it('reports that the write landed', async () => {
    vi.mocked(documentSession.put).mockResolvedValue(undefined);

    await expect(addDBExpense(anExpense)).resolves.toBe(true);
  });

  it('reports a failure instead of returning as though it worked', async () => {
    vi.mocked(documentSession.put).mockRejectedValue(new Error('IndexedDB is full'));

    // The caller closes its drawer on this answer. Swallowing the error and returning
    // undefined made a save that never happened indistinguishable from one that did —
    // the drawer shut either way and the only difference was a toast easy to miss.
    await expect(addDBExpense(anExpense)).resolves.toBe(false);
  });

  it('does not tell the outbox there is anything to send when the write failed', async () => {
    const { outbox } = await import('../document/outbox.container.ts');
    vi.mocked(documentSession.put).mockRejectedValue(new Error('nope'));

    await addDBExpense(anExpense);

    expect(outbox.markDirty).not.toHaveBeenCalled();
  });
});

describe('updateDBExpense', () => {
  it('reports that the change landed', async () => {
    vi.mocked(documentSession.update).mockResolvedValue(undefined);

    await expect(updateDBExpense('e1', anExpense)).resolves.toBe(true);
  });

  it('reports a failed change', async () => {
    vi.mocked(documentSession.update).mockRejectedValue(new Error('nope'));

    await expect(updateDBExpense('e1', anExpense)).resolves.toBe(false);
  });
});
