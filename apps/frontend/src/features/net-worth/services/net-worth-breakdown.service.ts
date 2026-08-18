import type { DBPosition } from '@/database/positions.ts';
import type { DBBondHolding } from '@/database/bonds.ts';
import { bondValueOn } from '@/features/net-worth/services/bond-accrual.service.ts';
import { netWorthWithBonds, type NetWorth } from '@/features/net-worth/services/net-worth.service.ts';
import i18n from '@/i18n.ts';

/** One block of a bar: a thing, and how much of the side it accounts for. */
export type Segment = {
  /** Stable across renders, because it is what the chart keys a colour and a stack on. */
  key: string;
  label: string;
  value: number;
};

export type NetWorthBreakdown = {
  held: Segment[];
  owed: Segment[];
  totals: NetWorth;
};

/** The key the gathered tail carries. */
export const OTHER_SEGMENT = 'other';

/**
 * Past a handful, a stacked bar stops being read and starts being decoded — and the blocks at the
 * end are too thin to point at anyway.
 */
const MOST_SEGMENTS = 6;

const round = (amount: number) => Number(amount.toFixed(2));

/**
 * Keeps the largest few and gathers the rest into one.
 *
 * The total is untouched: what is dropped is the distinction between things too small to see, not
 * their value.
 */
const largestFirst = (segments: Segment[]): Segment[] => {
  const sorted = [...segments].sort((one, other) => other.value - one.value);
  if (sorted.length <= MOST_SEGMENTS) return sorted;

  const kept = sorted.slice(0, MOST_SEGMENTS - 1);
  const tail = sorted.slice(MOST_SEGMENTS - 1);

  return [
    ...kept,
    {
      key: OTHER_SEGMENT,
      label: i18n.t('holdings.other_segment'),
      value: round(tail.reduce((sum, one) => sum + one.value, 0)),
    },
  ];
};

const ofKind = (positions: DBPosition[], kind: DBPosition['kind']): Segment[] =>
  positions
    .filter((position) => position.kind === kind)
    .map((position) => ({ key: position.id, label: position.description, value: position.value }));

/**
 * What the two sides of a net worth are made of.
 *
 * **Bonds arrive as one segment, at what they are worth today.** The table underneath already lists
 * them one by one, and a picture answering "what is this made of" should not spend six colours on
 * the part that has its own screen — nor make somebody update it, which is the whole point of a
 * holding whose value is computed.
 *
 * Positions come in already converted to one currency, as everywhere else in this app: conversion
 * happens at the rate of each record's own date, before the arithmetic, never after.
 */
export const netWorthBreakdown = (
  positions: DBPosition[],
  bonds: DBBondHolding[],
  today: Date
): NetWorthBreakdown => {
  const bondsWorth = round(
    bonds.reduce((total, bond) => total + bondValueOn(bond, today).value, 0)
  );

  const assets = [
    ...ofKind(positions, 'asset'),
    ...(bonds.length
      ? [{ key: 'bonds', label: i18n.t('bonds.title'), value: bondsWorth }]
      : []),
  ];

  return {
    held: largestFirst(assets),
    owed: largestFirst(ofKind(positions, 'liability')),
    totals: netWorthWithBonds(positions, bonds, today),
  };
};
