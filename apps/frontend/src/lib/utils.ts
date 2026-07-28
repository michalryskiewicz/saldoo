import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function transformValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return String(value);
  return String(value);
}

export function transformValueOnChange(input: string | unknown): string {
  if (input === undefined || input === null) return '';
  const str = String(input);
  // normalize comma to dot and remove all except digits, dot and minus
  const normalized = str.replace(',', '.').replace(/[^0-9.-]/g, '');
  const parts = normalized.split('.');
  if (parts.length <= 1) return parts[0];
  // keep first dot only
  return parts.shift() + '.' + parts.join('');
}

export function transformValueOnBlur(input: string | unknown): number | null {
  if (input === undefined || input === null) return null;
  const str = String(input).trim();
  if (str === '') return null;
  const normalized = str.replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}
