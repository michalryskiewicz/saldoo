import {
  getEffectiveDateForCurrency,
  formatDateISO,
  countWeekdaysInMonth,
  daysInMonth,
  getDatesInRange,
  isDateInRange,
} from '../dates';
import { describe, it, expect, vi } from 'vitest';

describe('DATES', () => {
  describe('getEffectiveDateForCurrency', () => {
    it('returns the same date if not today', () => {
      const date = new Date('2023-01-01T12:00:00Z');
      expect(getEffectiveDateForCurrency(date)).toBe('2023-01-01');
    });

    it('returns previous day if today and before 16:00', () => {
      const now = new Date('2023-01-02T10:00:00Z');

      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(getEffectiveDateForCurrency(now)).toBe('2023-01-01');
      vi.useRealTimers();
    });

    it('returns today if today and after 16:00', () => {
      const now = new Date('2023-01-02T17:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(getEffectiveDateForCurrency(now)).toBe('2023-01-02');
      vi.useRealTimers();
    });

    it('handles string input', () => {
      expect(getEffectiveDateForCurrency('2023-01-01')).toBe('2023-01-01');
    });
  });

  describe('formatDateISO', () => {
    it('formats Date object to ISO date string', () => {
      expect(formatDateISO(new Date('2023-05-10T15:00:00Z'))).toBe(
        '2023-05-10',
      );
    });

    it('formats string date to ISO date string', () => {
      expect(formatDateISO('2023-05-10T15:00:00Z')).toBe('2023-05-10');
    });
  });

  describe('countWeekdaysInMonth', () => {
    it('counts Mondays in January 2023', () => {
      expect(countWeekdaysInMonth(2023, 0, 1)).toBe(5);
    });

    it('returns 0 if weekday does not occur in month', () => {
      expect(countWeekdaysInMonth(2021, 1, 8)).toBe(0);
    });
  });

  describe('daysInMonth', () => {
    it('returns 28 for February 2023', () => {
      expect(daysInMonth(2023, 1)).toBe(28);
    });

    it('returns 29 for February 2024 (leap year)', () => {
      expect(daysInMonth(2024, 1)).toBe(29);
    });

    it('returns 31 for January', () => {
      expect(daysInMonth(2023, 0)).toBe(31);
    });
  });

  describe('getDatesInRange', () => {
    it('returns all dates between two dates inclusive', () => {
      expect(
        getDatesInRange(new Date('2023-01-01'), new Date('2023-01-03')),
      ).toEqual(['2023-01-01', '2023-01-02', '2023-01-03']);
    });

    it('returns single date if start and end are the same', () => {
      expect(
        getDatesInRange(new Date('2023-01-01'), new Date('2023-01-01')),
      ).toEqual(['2023-01-01']);
    });

    it('returns empty array if start is after end', () => {
      expect(
        getDatesInRange(new Date('2023-01-03'), new Date('2023-01-01')),
      ).toEqual([]);
    });
  });

  describe('isDateInRange', () => {
    it('returns true if date is within range', () => {
      expect(isDateInRange('2023-01-02', '2023-01-01', '2023-01-03')).toBe(
        true,
      );
    });

    it('returns true if date is equal to start', () => {
      expect(isDateInRange('2023-01-01', '2023-01-01', '2023-01-03')).toBe(
        true,
      );
    });

    it('returns true if date is equal to end', () => {
      expect(isDateInRange('2023-01-03', '2023-01-01', '2023-01-03')).toBe(
        true,
      );
    });

    it('returns false if date is before start', () => {
      expect(isDateInRange('2022-12-31', '2023-01-01', '2023-01-03')).toBe(
        false,
      );
    });

    it('returns false if date is after end', () => {
      expect(isDateInRange('2023-01-04', '2023-01-01', '2023-01-03')).toBe(
        false,
      );
    });

    it('handles Date objects as input', () => {
      expect(
        isDateInRange(
          new Date('2023-01-02'),
          new Date('2023-01-01'),
          new Date('2023-01-03'),
        ),
      ).toBe(true);
    });
  });
});
