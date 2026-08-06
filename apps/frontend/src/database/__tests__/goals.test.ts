import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addDBGoal, type GoalDraft } from '../goals.ts';
import { documentSession } from '../document/document.container.ts';
import { getSettings } from '../settings.ts';
import { STRATEGY_PART } from '@/constant.ts';

vi.mock('../document/document.container.ts', () => ({
  documentSession: { put: vi.fn(), update: vi.fn() },
}));
vi.mock('../document/outbox.container.ts', () => ({ outbox: { markDirty: vi.fn() } }));
vi.mock('../meta.ts', () => ({ setLastUpdated: vi.fn() }));
vi.mock('sonner', () => ({ toast: vi.fn() }));
vi.mock('../settings.ts', () => ({ getSettings: vi.fn() }));

const aHoliday: GoalDraft = {
  description: 'Wakacje',
  target: 8000,
  deadline: new Date('2027-07-01T00:00:00.000Z'),
  strategyPart: STRATEGY_PART.SAVINGS,
  keepsItsMoney: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSettings).mockResolvedValue({ currency: 'EUR' } as never);
});

describe('addDBGoal', () => {
  /**
   * The form never asks. Every other record in this app carries its own currency, so a goal is
   * not the exception — but which currency it is was decided in settings long before this form
   * was opened, and asking again is asking somebody to repeat themselves.
   */
  it('takes the currency from settings rather than from the caller', async () => {
    await addDBGoal(aHoliday);

    expect(documentSession.put).toHaveBeenCalledWith(
      'goals',
      expect.objectContaining({ currency: 'EUR' })
    );
  });

  /**
   * A yearly goal is one of a series, and the series is what makes a lifetime figure possible: it
   * is the closed windows plus the current pot. Minted here rather than by the caller — a form has
   * no business inventing an identity, and rollover reuses the one it finds.
   */
  it('gives a goal that rolls a series to belong to', async () => {
    await addDBGoal({ ...aHoliday, year: 2027 });

    expect(documentSession.put).toHaveBeenCalledWith(
      'goals',
      expect.objectContaining({ year: 2027, seriesId: expect.any(String) })
    );
  });

  it('gives a one-off goal no series, because there is nothing to tie it to', async () => {
    await addDBGoal({ description: 'Remont', target: 40000, deadline: new Date('2027-06-01T00:00:00.000Z'), strategyPart: STRATEGY_PART.SAVINGS, keepsItsMoney: false });

    const [, written] = vi.mocked(documentSession.put).mock.calls[0];

    expect(written).not.toHaveProperty('seriesId');
  });
});
