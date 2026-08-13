import { describe, expect, it } from 'vitest';
import { growthSeries } from '../growth-series.service.ts';

const said = (positionId: string, value: number, valuedOn: string) => ({
  positionId,
  value,
  valuedOn: new Date(valuedOn),
  createdAt: new Date(valuedOn),
});

describe('growthSeries', () => {
  /**
   * The answer to "is it growing", which nothing on the screen gave for the whole of somebody's
   * wealth — only per holding, and only against its own previous reading.
   */
  it('is what everything was worth on each day anybody said anything', () => {
    const history = [said('konto', 5000, '2026-05-01'), said('konto', 5500, '2026-08-01')];

    expect(growthSeries(history)).toEqual([
      { on: new Date('2026-05-01'), value: 5000 },
      { on: new Date('2026-08-01'), value: 5500 },
    ]);
  });

  /**
   * The point of the whole thing: on a day one holding was re-valued, the others are still worth
   * whatever they were last said to be. Counting only what moved would draw a line that dives every
   * time somebody values one account.
   */
  it('carries every other holding forward at its last known worth', () => {
    const history = [
      said('konto', 5000, '2026-05-01'),
      said('akcje', 3000, '2026-06-01'),
      said('konto', 5500, '2026-07-01'),
    ];

    expect(growthSeries(history)).toEqual([
      { on: new Date('2026-05-01'), value: 5000 },
      { on: new Date('2026-06-01'), value: 8000 },
      { on: new Date('2026-07-01'), value: 8500 },
    ]);
  });

  it('has one point where several holdings were valued on the same day', () => {
    // A second day on purpose: on one there is nothing to plot, so a case about a single day's
    // aggregation has to give the line somewhere to go.
    const history = [
      said('konto', 5000, '2026-05-01'),
      said('akcje', 3000, '2026-05-01'),
      said('konto', 5100, '2026-06-01'),
    ];

    expect(growthSeries(history)).toEqual([
      { on: new Date('2026-05-01'), value: 8000 },
      { on: new Date('2026-06-01'), value: 8100 },
    ]);
  });

  /** Two readings about one day are a correction, and the later saying is the one that counts. */
  it('takes the latest saying about a day', () => {
    const history = [
      { ...said('konto', 5000, '2026-05-01'), createdAt: new Date('2026-05-01T09:00:00Z') },
      { ...said('konto', 5200, '2026-05-01'), createdAt: new Date('2026-05-01T18:00:00Z') },
      said('konto', 5300, '2026-06-01'),
    ];

    expect(growthSeries(history)[0]).toEqual({ on: new Date('2026-05-01'), value: 5200 });
  });

  it('reads oldest first however the readings arrive', () => {
    const history = [said('konto', 5500, '2026-08-01'), said('konto', 5000, '2026-05-01')];

    expect(growthSeries(history).map((point) => point.value)).toEqual([5000, 5500]);
  });

  /**
   * A line needs two points to be a line. One reading is a dot, and drawing an axis around it says
   * "flat" about a holding nobody has valued twice.
   */
  it('says nothing where there is only one day to plot', () => {
    expect(growthSeries([said('konto', 5000, '2026-05-01')])).toEqual([]);
  });

  it('says nothing about nothing', () => {
    expect(growthSeries([])).toEqual([]);
  });
});
