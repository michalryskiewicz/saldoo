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
import { ExchangeRateService } from '../exchange-rate.service.ts';
import { CURRENCY } from '../../../utils/types.ts';

const mockedCacheGet = Cache.get as ReturnType<typeof vi.fn>;
const mockedCacheSet = Cache.set as ReturnType<typeof vi.fn>;
const mockedFindFirst = prisma.exchangeRate.findFirst as ReturnType<
  typeof vi.fn
>;
const mockedCreate = prisma.exchangeRate.create as ReturnType<typeof vi.fn>;

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedCacheGet.mockResolvedValue(undefined);
    mockedCacheSet.mockResolvedValue(undefined);
    mockedFindFirst.mockResolvedValue(null);
    mockedCreate.mockResolvedValue({});
    service = new ExchangeRateService();
  });

  describe('convertMoney', () => {
    it('returns the original amount when currencies match', async () => {
      const result = await service.convertMoney(
        100,
        CURRENCY.USD,
        CURRENCY.USD,
        new Date('2024-03-04'),
      );

      expect(result).toBe(100);
      expect(mockedCacheGet).not.toHaveBeenCalled();
    });

    it('uses the cached rate when present', async () => {
      mockedCacheGet.mockResolvedValueOnce(4);

      const result = await service.convertMoney(
        10,
        CURRENCY.USD,
        CURRENCY.PLN,
        new Date('2024-03-04T20:00:00Z'),
      );

      expect(result).toBe(40);
      expect(mockedFindFirst).not.toHaveBeenCalled();
    });

    it('falls back to the database when the cache is empty and caches the result', async () => {
      mockedCacheGet.mockResolvedValueOnce(undefined);
      mockedFindFirst.mockResolvedValueOnce({ mid: 5 });

      const result = await service.convertMoney(
        2,
        CURRENCY.USD,
        CURRENCY.PLN,
        new Date('2024-03-04T20:00:00Z'),
      );

      expect(mockedFindFirst).toHaveBeenCalledTimes(1);
      expect(mockedCacheSet).toHaveBeenCalledWith(
        expect.stringContaining('USD-PLN-'),
        5,
      );
      expect(result).toBe(10);
    });

    it('inverts the rate when going from PLN to a foreign currency', async () => {
      mockedCacheGet.mockResolvedValueOnce(undefined);
      mockedFindFirst.mockResolvedValueOnce({ mid: 4 });

      const result = await service.convertMoney(
        20,
        CURRENCY.PLN,
        CURRENCY.USD,
        new Date('2024-03-04T20:00:00Z'),
      );

      // 1/4 * 20 = 5
      expect(result).toBe(5);
    });

    it('returns -1 when no rate can be resolved', async () => {
      mockedCacheGet.mockResolvedValue(undefined);
      mockedFindFirst.mockResolvedValue(null);
      fetchMock.mockResolvedValue({
        json: async () => ({ rates: [] }),
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.convertMoney(
        1,
        CURRENCY.USD,
        CURRENCY.PLN,
        new Date('2024-03-04T20:00:00Z'),
      );

      expect(result).toBe(-1);
      errorSpy.mockRestore();
    });

    it('uses PLN as a bridge when neither currency is PLN', async () => {
      mockedCacheGet.mockResolvedValueOnce(undefined); // USD-EUR
      // First findFirst -> USD-PLN call
      mockedFindFirst.mockResolvedValueOnce({ mid: 4 });
      // Second findFirst -> EUR-PLN call
      mockedFindFirst.mockResolvedValueOnce({ mid: 5 });

      const result = await service.convertMoney(
        100,
        CURRENCY.USD,
        CURRENCY.EUR,
        new Date('2024-03-04T20:00:00Z'),
      );

      // USD -> PLN: 4, EUR -> PLN: 5; USD -> EUR = 4/5 = 0.8 → 100 * 0.8 = 80
      expect(result).toBe(80);
    });
  });

  describe('convertDataToDesiredCurrency', () => {
    it('passes items through when their currency already matches', async () => {
      const items = [{ amount: 10, currency: CURRENCY.USD }];

      const result = await service.convertDataToDesiredCurrency(
        items,
        CURRENCY.USD,
        'amount',
      );

      expect(result).toEqual(items);
    });

    it('converts mismatched items and rounds to 2 decimals', async () => {
      const convertSpy = vi
        .spyOn(service, 'convertMoney')
        .mockResolvedValue(7.456);

      const items = [{ amount: 10, currency: CURRENCY.PLN }];
      const result = await service.convertDataToDesiredCurrency(
        items,
        CURRENCY.USD,
        'amount',
      );

      expect(convertSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual([{ amount: 7.46, currency: CURRENCY.USD }]);
    });
  });

  describe('getExchangeRatesForDateRange', () => {
    it('returns one entry per day in the inclusive range', async () => {
      const convertSpy = vi
        .spyOn(service, 'convertMoney')
        .mockResolvedValue(1.5);

      const rates = await service.getExchangeRatesForDateRange(
        CURRENCY.USD,
        CURRENCY.PLN,
        new Date('2024-03-04'),
        new Date('2024-03-06'),
      );

      expect(rates).toHaveLength(3);
      expect(rates.map((r) => r.date)).toEqual([
        '2024-03-04',
        '2024-03-05',
        '2024-03-06',
      ]);
      expect(rates.every((r) => r.rate === 1.5)).toBe(true);
      expect(convertSpy).toHaveBeenCalledTimes(3);
    });

    it('shifts Saturday queries back to Friday', async () => {
      const convertSpy = vi
        .spyOn(service, 'convertMoney')
        .mockResolvedValue(2);

      // 2024-03-09 is a Saturday
      await service.getExchangeRatesForDateRange(
        CURRENCY.USD,
        CURRENCY.PLN,
        new Date('2024-03-09'),
        new Date('2024-03-09'),
      );

      const calledDate = convertSpy.mock.calls[0][3] as Date;
      // expect Friday (one day before)
      expect(calledDate.getDay()).toBe(5);
    });

    it('shifts Sunday queries back to Friday', async () => {
      const convertSpy = vi
        .spyOn(service, 'convertMoney')
        .mockResolvedValue(2);

      // 2024-03-10 is a Sunday
      await service.getExchangeRatesForDateRange(
        CURRENCY.USD,
        CURRENCY.PLN,
        new Date('2024-03-10'),
        new Date('2024-03-10'),
      );

      const calledDate = convertSpy.mock.calls[0][3] as Date;
      expect(calledDate.getDay()).toBe(5);
    });
  });
});
