import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addDBGoal, applyDBRollovers, type GoalDraft } from '../goals.ts';
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

describe('applyDBRollovers', () => {
  const rollover = {
    closing: {
      goalId: 'g-2026',
      seriesId: 's1',
      year: 2026,
      target: 30000,
      contributed: 26000,
      openedOn: new Date(2026, 0, 1),
      closedOn: new Date(2026, 11, 31),
    },
    opening: {
      description: 'IKE',
      strategyPart: STRATEGY_PART.LONG_TERM_SAVINGS,
      keepsItsMoney: true,
      target: 30000,
      deadline: new Date(2027, 11, 31),
      year: 2027,
      seriesId: 's1',
    },
  };

  /**
   * Three writes and all three matter. Without the record the 26 000 are nowhere; without the new
   * window there is nothing to contribute to in January; without closing the old one the app rolls
   * it again on the next visit.
   */
  it('records the year, opens the next, and closes the one that ended', async () => {
    await applyDBRollovers([rollover]);

    expect(documentSession.put).toHaveBeenCalledWith(
      'closedWindows',
      expect.objectContaining({ year: 2026, contributed: 26000, seriesId: 's1' })
    );
    expect(documentSession.put).toHaveBeenCalledWith(
      'goals',
      expect.objectContaining({ year: 2027, seriesId: 's1', description: 'IKE' })
    );
    expect(documentSession.update).toHaveBeenCalledWith(
      'goals',
      'g-2026',
      expect.objectContaining({ closedAt: expect.any(Date) })
    );
  });

  it('does nothing at all when no window has ended', async () => {
    await applyDBRollovers([]);

    expect(documentSession.put).not.toHaveBeenCalled();
    expect(documentSession.update).not.toHaveBeenCalled();
  });
});
