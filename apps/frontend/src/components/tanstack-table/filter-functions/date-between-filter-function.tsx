import { type FilterFn } from '@tanstack/react-table';

export const dateBetweenFilterFn: FilterFn<string | Date | number> = (row, columnId, value) => {
  const date: Date | string = row.getValue(columnId);
  if (!date) return false;
  // Support both [start, end] and {from, to} filter value formats
  let start: Date | undefined, end: Date | undefined;
  if (Array.isArray(value)) {
    [start, end] = value;
  } else if (value && typeof value === 'object') {
    start = value.from;
    end = value.to;
  }
  const dateToUse = new Date(date);
  if ((start || end) && isNaN(dateToUse.getTime())) return false;
  if (start && !end) {
    return dateToUse.getTime() >= new Date(start).getTime();
  } else if (!start && end) {
    return dateToUse.getTime() <= new Date(end).getTime();
  } else if (start && end) {
    return (
      dateToUse.getTime() >= new Date(start).getTime() &&
      dateToUse.getTime() <= new Date(end).getTime()
    );
  } else return true;
};

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
dateBetweenFilterFn.autoRemove;

export default dateBetweenFilterFn;
