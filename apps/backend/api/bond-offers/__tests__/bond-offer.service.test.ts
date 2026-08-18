import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';

// The service reaches for the shared client by default; every test here passes its own store in,
// so this only has to exist rather than work.
vi.mock('../../../prisma/prisma.ts', () => ({ default: { bondOffer: {} } }));
import { BondOfferService, issueUrl } from '../bond-offer.service.ts';

const page = (rate: string, month: string) => `
  Cena sprzedaży jednej obligacji: 100,00 zł
  Sprzedaż: 01.${month}.2026 - 31.${month}.2026
  Oprocentowanie: ${rate}% w pierwszym rocznym okresie odsetkowym, w kolejnych rocznych okresach
  odsetkowych: marża 2,00% + inflacja
`;

const store = () => {
  const rows: Record<string, unknown>[] = [];

  return {
    rows,
    bondOffer: {
      upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
        rows.push(create);
        return create;
      }),
      findMany: vi.fn(async () => rows),
    },
  };
};

describe('issueUrl', () => {
  /**
   * Checked against addresses that exist. The series is named for the month it is **redeemed**, so
   * a ten-year sold in August 2026 lives under EDO0836 — get that backwards and every request 404s,
   * or worse, lands on a real page for a different year.
   */
  it('addresses the issue sold in a given month', () => {
    expect(issueUrl('EDO', '2026-08')).toBe(
      'https://www.obligacjeskarbowe.pl/oferta-obligacji/obligacje-10-letnie-edo/edo0836/'
    );
    expect(issueUrl('ROR', '2026-08')).toBe(
      'https://www.obligacjeskarbowe.pl/oferta-obligacji/obligacje-roczne-ror/ror0827/'
    );
    expect(issueUrl('COI', '2026-08')).toBe(
      'https://www.obligacjeskarbowe.pl/oferta-obligacji/obligacje-4-letnie-coi/coi0830/'
    );
  });
});

describe('BondOfferService.refreshMonth', () => {
  it('records what it could read, for every series on offer', async () => {
    const db = store();
    const service = new BondOfferService(db as never, async () => page('5,35', '08'));

    const report = await service.refreshMonth('2026-08');

    expect(report.recorded).toBe(7);
    expect(report.unreadable).toEqual([]);
    expect(db.rows).toHaveLength(7);
    expect(db.rows[0]).toMatchObject({ month: '2026-08', ratePercent: 5.35, nominal: 100 });
  });

  /**
   * The guard that makes a guessed address safe. A page that answers 200 about a different month is
   * a wrong page, and filing its rate under the month we asked for would put a real number under a
   * date nobody published it for — the one failure worse than not fetching at all.
   */
  it('refuses a page that turns out to be about another month', async () => {
    const db = store();
    const service = new BondOfferService(db as never, async () => page('7,25', '03'));

    const report = await service.refreshMonth('2026-08');

    expect(report.recorded).toBe(0);
    expect(report.unreadable).toHaveLength(7);
    expect(db.bondOffer.upsert).not.toHaveBeenCalled();
  });

  /**
   * A month whose issues are not published yet is the ordinary case on the first of the month, and
   * a site that has been redesigned is the feared one. Both look the same from here, and both leave
   * whatever was already recorded exactly as it was.
   */
  it('writes nothing when a page cannot be read, and says which', async () => {
    const db = store();
    const service = new BondOfferService(db as never, async () => '<h1>404</h1>');

    const report = await service.refreshMonth('2026-08');

    expect(report.recorded).toBe(0);
    expect(report.unreadable).toContain('EDO');
    expect(db.bondOffer.upsert).not.toHaveBeenCalled();
  });

  it('survives a series whose page will not load at all', async () => {
    const db = store();
    const service = new BondOfferService(db as never, async (url) => {
      if (url.includes('edo')) throw new Error('ECONNRESET');
      return page('4,75', '08');
    });

    const report = await service.refreshMonth('2026-08');

    expect(report.recorded).toBe(6);
    expect(report.unreadable).toEqual(['EDO']);
  });
});
