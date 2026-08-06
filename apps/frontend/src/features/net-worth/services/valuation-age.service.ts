import i18n from '@/i18n.ts';
import { formatDate } from '@/lib/formats.ts';

/**
 * How old the figure is, in words.
 *
 * Stated rather than implied. A tile carrying a number with no date on it reads as current, and
 * the one thing a hand-valued net worth is not is automatically current — the whole figure is as
 * old as whichever part somebody last got round to updating.
 */
export const formatValuationAge = (valuedOn: Date | undefined): string =>
  valuedOn
    ? i18n.t('holdings.as_of', { date: formatDate(valuedOn) })
    : i18n.t('holdings.never_valued');
