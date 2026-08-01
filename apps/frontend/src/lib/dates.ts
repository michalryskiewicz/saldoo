import { getISOWeek } from 'date-fns';

export const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2000, i))
);

export function countWeekdaysInMonth(year: number, monthIdx: number, weekday: number) {
  let count = 0;
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIdx, day);
    if (date.getDay() === weekday) count++;
  }
  return count;
}

export const getFromDate = (date?: Date | string | undefined | null) => {
  // today or provided date
  if (!date) {
    console.error(new Error('Please provide a valid date'));
    return { year: -1, month: -1, day: -1 };
  }

  const dateToUse = new Date(date);

  return {
    year: dateToUse.getFullYear(),
    month: dateToUse.getMonth(),
    week: getISOWeek(dateToUse),
    day: dateToUse.getDay(),
  };
};

export function daysInMonth(year: number, monthIdx: number) {
  return new Date(year, monthIdx + 1, 0).getDate();
}


/**
 * Returns the earliest and latest date from an array of objects by a given key.
 * If format is true or 'iso-date', returns YYYY-MM-DD string, otherwise returns Date objects.
 * @param items Array of objects
 * @param dateKey Key in the object containing the date (string or Date)
 * @param format Optional: true | 'iso-date' to return YYYY-MM-DD string, otherwise Date
 * @returns { earliest, latest } as Date | string (YYYY-MM-DD)
 */
export function getEarliestAndLatestDate<T>(
  items: T[],
  dateKey: keyof T,
  format?: boolean | 'iso-date'
): { earliest: Date | string | null; latest: Date | string | null } {
  const dates = items
    .map((item) => {
      const value = item[dateKey];
      if (!value) return null;
      const date = typeof value === 'string' ? new Date(value) : value;
      if (date instanceof Date && !isNaN(date.getTime())) {
        return date;
      }
      return null;
    })
    .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));

  if (dates.length === 0) return { earliest: null, latest: null };

  const earliestDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const latestDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  if (format === true || format === 'iso-date') {
    return {
      earliest: toISODate(earliestDate),
      latest: toISODate(latestDate),
    };
  }

  return { earliest: earliestDate, latest: latestDate };
}

export function toISODate(date: Date | string | number): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) {
    throw new Error('Invalid date');
  }
  return d.toISOString().split('T')[0];
}
