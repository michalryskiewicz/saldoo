import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addDBContribution } from '../contributions.ts';
import { documentSession } from '../document/document.container.ts';

vi.mock('../document/document.container.ts', () => ({
  documentSession: { put: vi.fn(), update: vi.fn() },
}));
vi.mock('../document/outbox.container.ts', () => ({ outbox: { markDirty: vi.fn() } }));
vi.mock('../meta.ts', () => ({ setLastUpdated: vi.fn() }));
vi.mock('sonner', () => ({ toast: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addDBContribution', () => {
  /**
   * A dated amount against a goal, and nothing else. No currency: it is the goal's, and a second
   * copy could disagree with it. No exchange rate: the date is enough, and the converter reads the
   * rate for it.
   */
  it('records the amount, the day and the goal it belongs to', async () => {
    await addDBContribution({
      goalId: 'g1',
      amount: 500,
      contributedAt: new Date('2026-08-06T00:00:00.000Z'),
    });

    expect(documentSession.put).toHaveBeenCalledWith(
      'contributions',
      expect.objectContaining({
        goalId: 'g1',
        amount: 500,
        contributedAt: new Date('2026-08-06T00:00:00.000Z'),
      })
    );
  });

  it('reports a failure instead of returning as though it worked', async () => {
    vi.mocked(documentSession.put).mockRejectedValue(new Error('IndexedDB is full'));

    await expect(
      addDBContribution({ goalId: 'g1', amount: 500, contributedAt: new Date() })
    ).resolves.toBe(false);
  });

  it('does not tell the outbox there is anything to send when the write failed', async () => {
    const { outbox } = await import('../document/outbox.container.ts');
    vi.mocked(documentSession.put).mockRejectedValue(new Error('nope'));

    await addDBContribution({ goalId: 'g1', amount: 500, contributedAt: new Date() });

    expect(outbox.markDirty).not.toHaveBeenCalled();
  });
});
