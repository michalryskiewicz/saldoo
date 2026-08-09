import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../prisma/prisma.ts', () => ({
  default: {
    exchangeRate: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../../../utils/cache.ts', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  },
}));

import prisma from '../../../prisma/prisma.ts';
import Cache from '../../../utils/cache.ts';
import { ExchangeRatesRangeService } from '../exchange-rates-range.service.ts';
import { CURRENCY } from '../../../utils/types.ts';

const mockedCacheGet = Cache.get as ReturnType<typeof vi.fn>;
const mockedCacheSet = Cache.set as ReturnType<typeof vi.fn>;
const mockedFindMany = prisma.exchangeRate.findMany as ReturnType<typeof vi.fn>;
const mockedFindFirst = prisma.exchangeRate.findFirst as ReturnType<
  typeof vi.fn
>;
const mockedCreate = prisma.exchangeRate.create as ReturnType<typeof vi.fn>;

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('ExchangeRatesRangeService', () => {
  let service: ExchangeRatesRangeService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedCacheGet.mockResolvedValue(undefined);
    mockedCacheSet.mockResolvedValue(undefined);
    mockedFindMany.mockResolvedValue([]);
    mockedFindFirst.mockResolvedValue(null);
    mockedCreate.mockResolvedValue({});
    fetchMock.mockResolvedValue({ json: async () => ({ rates: [] }) });
    service = new ExchangeRatesRangeService();
  });

  it('returns 1 for every date when the currencies are equal', async () => {
    const result =
      await service.getExchangeRatesForDateRangeUsingNBPRange(
        CURRENCY.USD,
        CURRENCY.USD,
        new Date('2024-03-04'),
        new Date('2024-03-06'),
      );

    // The service may append today's ISO date to the result set, so we
    // assert the property of every entry rather than the exact count.
    const values = Object.values(result);
    expect(values.length).toBeGreaterThanOrEqual(3);
    expect(values.every((r) => r === 1)).toBe(true);
  });

  it('serves all dates from cache when the final-pair cache is fully populated', async () => {
    mockedCacheGet.mockImplementation(async (key: string) => {
      if (key.startsWith('USD-PLN-')) return 4;
      return undefined;
    });

    const result =
      await service.getExchangeRatesForDateRangeUsingNBPRange(
        CURRENCY.USD,
        CURRENCY.PLN,
        new Date('2024-03-04'),
        new Date('2024-03-05'),
      );

    expect(result['2024-03-04']).toBe(4);
    expect(result['2024-03-05']).toBe(4);
    // Skipped DB lookup because cache hit
    expect(mockedFindMany).not.toHaveBeenCalled();
  });

  it('falls back to DB rates when the cache misses', async () => {
    mockedFindMany.mockResolvedValueOnce([
      { effectiveDate: new Date('2024-03-04'), mid: 3 },
      { effectiveDate: new Date('2024-03-05'), mid: 3.5 },
    ]);

    const result =
      await service.getExchangeRatesForDateRangeUsingNBPRange(
        CURRENCY.USD,
        CURRENCY.PLN,
        new Date('2024-03-04'),
        new Date('2024-03-05'),
      );

    expect(result['2024-03-04']).toBe(3);
    expect(result['2024-03-05']).toBe(3.5);
  });

  it('inverts foreign-to-PLN rates when querying PLN to a foreign currency', async () => {
    // For PLN -> USD, the service issues a single DB query (USD -> PLN).
    mockedFindMany.mockResolvedValueOnce([
      { effectiveDate: new Date('2024-03-04'), mid: 4 },
    ]);

    const result =
      await service.getExchangeRatesForDateRangeUsingNBPRange(
        CURRENCY.PLN,
        CURRENCY.USD,
        new Date('2024-03-04'),
        new Date('2024-03-04'),
      );

    expect(result['2024-03-04']).toBeCloseTo(0.25);
  });

  it('falls back to NBP HTTP fetch when DB has no rates', async () => {
    mockedFindMany.mockResolvedValue([]);
    fetchMock.mockResolvedValue({
      json: async () => ({
        rates: [{ effectiveDate: '2024-03-04', mid: 4 }],
      }),
    });

    const result =
      await service.getExchangeRatesForDateRangeUsingNBPRange(
        CURRENCY.USD,
        CURRENCY.PLN,
        new Date('2024-03-04'),
        new Date('2024-03-04'),
      );

    expect(fetchMock).toHaveBeenCalled();
    expect(result['2024-03-04']).toBe(4);
  });

  describe('when the window opens on a day NBP publishes nothing for', () => {
    it('carries in the last rate published before the window', async () => {
      // A weekend is where this bit: asked for Saturday to Sunday, the service could only fill a
      // gap from an earlier day inside the window, and there is no earlier day inside a window
      // that opens on the gap. Every figure came back null and the frontend printed złoty under
      // a euro sign. Friday's rate stood all weekend and has to be reachable from outside.
      mockedFindMany.mockResolvedValue([
        { effectiveDate: new Date('2026-08-07'), mid: 4.5 },
      ]);

      const result = await service.getExchangeRatesForDateRangeUsingNBPRange(
        CURRENCY.EUR,
        CURRENCY.PLN,
        new Date('2026-08-08'),
        new Date('2026-08-09'),
      );

      expect(result['2026-08-08']).toBe(4.5);
      expect(result['2026-08-09']).toBe(4.5);
    });

    it('carries the last known rate into a window that has not happened yet', async () => {
      // The duties screen looks forward, so its window routinely holds no day NBP has published a
      // rate for. The latest rate anybody has is the only rate there is for next month, and a duty
      // shown without it is a złoty figure under a euro sign.
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-09T12:00:00Z'));
      mockedFindMany.mockResolvedValue([
        { effectiveDate: new Date('2026-08-07'), mid: 4.5 },
      ]);

      const result = await service.getExchangeRatesForDateRangeUsingNBPRange(
        CURRENCY.EUR,
        CURRENCY.PLN,
        new Date('2026-09-01'),
        new Date('2026-09-30'),
      );

      expect(result['2026-09-01']).toBe(4.5);
      expect(result['2026-09-30']).toBe(4.5);

      vi.useRealTimers();
    });
  });

  it('returns null entries when no rate can be resolved', async () => {
    mockedFindMany.mockResolvedValue([]);
    fetchMock.mockResolvedValue({ json: async () => ({ rates: [] }) });

    const result =
      await service.getExchangeRatesForDateRangeUsingNBPRange(
        CURRENCY.USD,
        CURRENCY.PLN,
        new Date('2024-03-04'),
        new Date('2024-03-04'),
      );

    expect(result['2024-03-04']).toBeNull();
  });
});
