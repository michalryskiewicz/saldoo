import { describe, expect, it } from 'vitest';
import { formatValuationAge } from '../valuation-age.service.ts';

describe('formatValuationAge', () => {
  /**
   * Said, not implied. A number with no date on it reads as current, and the one thing a
   * hand-valued net worth is not is automatically current.
   */
  it('names the day the oldest part was last valued', () => {
    expect(formatValuationAge(new Date(2026, 6, 1))).toContain('2026');
  });

  it('says there is nothing to value rather than showing an empty date', () => {
    expect(formatValuationAge(undefined)).not.toContain('undefined');
    expect(formatValuationAge(undefined).length).toBeGreaterThan(0);
  });
});
