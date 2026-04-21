import {
  formatISO,
  subDays,
  isToday,
  isWithinInterval,
  getISOWeek,
  startOfYear,
  addWeeks,
  setDay,
  getMonth,
} from 'date-fns';

export type MonthIndex =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | number;

export function formatDateISO(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatISO(dateObj, { representation: 'date' });
}

export function getEffectiveDateForCurrency(
  effectiveDate: string | Date,
): string {
  let dateObj =
    typeof effectiveDate === 'string' ? new Date(effectiveDate) : effectiveDate;
  const now = new Date();

  // Only apply adjustments if the effective date is today
  if (isToday(dateObj)) {
    if (now.getDay() === 6) {
      // Saturday: go back to Friday
      dateObj = subDays(dateObj, 1);
    } else if (now.getDay() === 0) {
      // Sunday: go back to Friday
      dateObj = subDays(dateObj, 2);
    } else if (now.getHours() < 16) {
      dateObj = subDays(dateObj, 1);
    }
  }

  return formatDateISO(dateObj);
}

export function countWeekdaysInMonth(
  year: number,
  monthIdx: number,
  weekday: number,
) {
  let count = 0;
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIdx, day);
    if (date.getDay() === weekday) count++;
  }
  return count;
}

export function daysInMonth(year: number, monthIdx: number) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

export function getDatesInRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function isDateInRange(
  day: Date | string,
  start: Date | string,
  end: Date | string,
): boolean {
  const dayObj = typeof day === 'string' ? new Date(day) : day;
  const startObj = typeof start === 'string' ? new Date(start) : start;
  const endObj = typeof end === 'string' ? new Date(end) : end;
  return isWithinInterval(dayObj, { start: startObj, end: endObj });
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
    month: dateToUse.getMonth() as MonthIndex,
    week: getISOWeek(dateToUse),
    day: dateToUse.getDay(),
  };
};
