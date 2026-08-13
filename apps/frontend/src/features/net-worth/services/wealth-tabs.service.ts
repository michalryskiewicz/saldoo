import { ASSET_TYPE } from '@/constant.ts';
import type { PositionKind } from '@/database/positions.ts';

/**
 * Where a holding nobody has said the kind of lives.
 *
 * It needs somewhere, or the tabs make it unreachable — and unreachable means it can never be given
 * the type it is missing. The allocation card asks for these; this is where somebody goes to answer.
 */
export const UNTYPED_TAB = 'UNTYPED' as const;

/**
 * Where what is owed lives.
 *
 * Owing is not a kind of asset and has no place in an allocation, so a mortgage must not conjure a
 * "property" tab. But it cannot be left out either: tabs that skip it make a large figure unreachable,
 * and unreachable means nobody can correct it.
 */
export const OWED_TAB = 'OWED' as const;

export type WealthTab = ASSET_TYPE | typeof UNTYPED_TAB | typeof OWED_TAB;

type Grouped = { kind: PositionKind; assetType?: ASSET_TYPE };

/**
 * Which tabs the wealth section should offer, given what is actually held.
 *
 * **Only the kinds something is held under.** A tab per member of the enum would put ten tabs, eight
 * of them empty, on an account with two holdings — more clicking than content, and a screen that reads
 * as a filing cabinet rather than as somebody's money.
 *
 * In the enum's own order rather than the order things were entered, so the tabs do not reshuffle
 * themselves as holdings are added — a row of tabs that moves is a row nobody learns.
 *
 * Bonds earn their tab from there *being* bonds rather than from a position typed as such: the app
 * prices those itself and they are not positions at all. Held once either way.
 *
 * What is owed gets a tab of its own rather than a kind: owing is not an asset class, and leaving it
 * out altogether would make a mortgage unreachable — a large figure nobody could open or correct.
 */
export const wealthTabs = (positions: Grouped[], hasBonds: boolean): WealthTab[] => {
  const held = positions.filter((position) => position.kind === 'asset');
  const kinds = new Set(
    held.map((position) => position.assetType).filter((type) => type !== undefined)
  );

  if (hasBonds) kinds.add(ASSET_TYPE.BONDS);

  const tabs: WealthTab[] = Object.values(ASSET_TYPE).filter((type) => kinds.has(type));

  // After the kinds, because it answers a different question from all of them.
  if (positions.some((position) => position.kind === 'liability')) tabs.push(OWED_TAB);

  // Last, because it is a thing to be dealt with rather than a kind of holding.
  if (held.some((position) => position.assetType === undefined)) tabs.push(UNTYPED_TAB);

  return tabs;
};
