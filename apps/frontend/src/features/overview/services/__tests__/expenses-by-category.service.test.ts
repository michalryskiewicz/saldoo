import { describe, expect, it } from 'vitest';
import { categoriesBySize, categoryChartHeight } from '../expenses-by-category.service.ts';

describe('categoriesBySize', () => {
  it('puts the biggest first, which is the order a bar chart is read in', () => {
    const categories = [
      { tag: 'TRANSPORT', total: 480 },
      { tag: 'MIESZKANIE', total: 2500 },
      { tag: 'JEDZENIE', total: 1200 },
    ];

    expect(categoriesBySize(categories).map((category) => category.tag)).toEqual([
      'MIESZKANIE',
      'JEDZENIE',
      'TRANSPORT',
    ]);
  });

  it('leaves the given list alone', () => {
    const categories = [
      { tag: 'TRANSPORT', total: 480 },
      { tag: 'MIESZKANIE', total: 2500 },
    ];

    categoriesBySize(categories);

    expect(categories[0].tag).toBe('TRANSPORT');
  });

  it('copes with nothing to sort', () => {
    expect(categoriesBySize([])).toEqual([]);
  });
});

describe('categoryChartHeight', () => {
  it('grows a row at a time, so a bar is the same thickness however many there are', () => {
    // A fixed box is what makes a radar out of one category and a comb out of twelve.
    // Both pairs taken above the floor, where the count is what decides the height.
    expect(categoryChartHeight(12)).toBeGreaterThan(categoryChartHeight(6));
    expect(categoryChartHeight(12) - categoryChartHeight(11)).toBe(
      categoryChartHeight(7) - categoryChartHeight(6)
    );
  });

  it('keeps a floor, so one category is a chart rather than a stripe', () => {
    expect(categoryChartHeight(1)).toBe(categoryChartHeight(0));
    expect(categoryChartHeight(1)).toBeGreaterThanOrEqual(120);
  });
});
