import axios from 'axios';
import prisma from '../../prisma/prisma.ts';
import { parseIssuePage } from './bond-offer.parser.ts';
import { issueUrl, SERIES, type BondSeriesCode } from './bond-series.ts';

export type { BondSeriesCode };
export { issueUrl };

export type RefreshReport = {
  month: string;
  recorded: number;
  /** The series whose page could not be read, or was about another month. */
  unreadable: BondSeriesCode[];
};

export type FetchPage = (url: string) => Promise<string>;

const fetchPage: FetchPage = async (url) => {
  const { data } = await axios.get<string>(url, {
    timeout: 15_000,
    // Announced rather than disguised: this reads a handful of public pages once a week.
    headers: { 'User-Agent': 'Saldoo/1.0 (+https://app.saldoo.io) bond offer reader' },
  });

  return typeof data === 'string' ? data : String(data);
};

/**
 * Keeps a record of the published retail offer, so nobody has to add a line by hand every month.
 *
 * **It is allowed to stop working, and not allowed to be quietly wrong.** Every failure — a page
 * that will not load, one that has been redesigned, one that turns out to be about another month —
 * leaves whatever was already recorded untouched and is reported by series. The app ships a
 * catalogue of its own and keeps working when this table is empty, so the worst outcome of a
 * broken source is that the newest month has to be typed in, exactly as before.
 *
 * **Deliberately carries no tsyringe decorator.** Its two collaborators are a module singleton and a
 * function, and neither is a type the container can reflect: with a decorator on the class,
 * `design:paramtypes` comes out as `["Object", "Object"]` under bun and tsyringe throws
 * `TypeInfo not known for "Object"` while constructing it — which took the **whole backend** down at
 * module load, since a controller resolved at import time throws before anything listens. Undecorated,
 * no parameter metadata is emitted, the container calls the constructor with no arguments, and the
 * defaults below stand. The seam the tests inject through is untouched.
 *
 * Note that vitest's transform does not emit that metadata, so no unit test can see this. It is
 * verified by the backend starting.
 */
export class BondOfferService {
  constructor(
    private readonly db: typeof prisma = prisma,
    private readonly get: FetchPage = fetchPage,
  ) {}

  async refreshMonth(month: string): Promise<RefreshReport> {
    const unreadable: BondSeriesCode[] = [];
    let recorded = 0;

    for (const code of Object.keys(SERIES) as BondSeriesCode[]) {
      const url = issueUrl(code, month);

      const issue = await this.get(url)
        .then(parseIssuePage)
        .catch(() => undefined);

      // A page about another month is a wrong page. Writing its rate under the month we asked for
      // would put a real figure beside a date nobody published it for.
      if (!issue || (issue.soldIn && issue.soldIn !== month)) {
        unreadable.push(code);
        continue;
      }

      const row = {
        series: code,
        month,
        ratePercent: issue.ratePercent,
        marginPercent: issue.marginPercent ?? null,
        nominal: issue.nominal ?? null,
        source: url,
        checkedAt: new Date(),
      };

      await this.db.bondOffer.upsert({
        where: { series_month: { series: code, month } },
        create: row,
        update: row,
      });

      recorded += 1;
    }

    return { month, recorded, unreadable };
  }

  /**
   * The current month and the one before it.
   *
   * Two, because the run that matters is the one on the first weekend of a month, when this month's
   * issues may not be up yet — and because a week where the source was down should not cost a month
   * permanently.
   */
  async refreshRecent(today: Date): Promise<RefreshReport[]> {
    const months = [0, -1].map((offset) => {
      const month = new Date(today.getFullYear(), today.getMonth() + offset, 1);

      return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    });

    return [await this.refreshMonth(months[0]), await this.refreshMonth(months[1])];
  }

  async listOffers() {
    return this.db.bondOffer.findMany({ orderBy: [{ month: 'desc' }, { series: 'asc' }] });
  }
}
