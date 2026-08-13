import { describe, expect, it } from 'vitest';
import { ASSET_TYPE } from '@/constant.ts';
import { OWED_TAB, UNTYPED_TAB, wealthTabs } from '../wealth-tabs.service.ts';

const held = (assetType?: ASSET_TYPE) => ({ kind: 'asset' as const, assetType });
const owed = (assetType?: ASSET_TYPE) => ({ kind: 'liability' as const, assetType });

describe('wealthTabs', () => {
  /**
   * Only the kinds somebody actually holds. A tab per kind in the enum would mean eight tabs, six of
   * them empty, on an account with two holdings — more clicking than content, and a screen that reads
   * as a filing cabinet rather than as money.
   */
  it('offers a tab for each kind something is held under', () => {
    expect(wealthTabs([held(ASSET_TYPE.ETF), held(ASSET_TYPE.REAL_ESTATE)], false)).toEqual([
      ASSET_TYPE.REAL_ESTATE,
      ASSET_TYPE.ETF,
    ]);
  });

  it('offers nothing for a kind nothing is held under', () => {
    expect(wealthTabs([held(ASSET_TYPE.ETF)], false)).toEqual([ASSET_TYPE.ETF]);
  });

  /** In the enum's own order, so the tabs do not reshuffle themselves as holdings are added. */
  it('keeps a stable order rather than the order things were entered', () => {
    expect(
      wealthTabs([held(ASSET_TYPE.STOCKS), held(ASSET_TYPE.CASH), held(ASSET_TYPE.REAL_ESTATE)], false)
    ).toEqual([ASSET_TYPE.CASH, ASSET_TYPE.REAL_ESTATE, ASSET_TYPE.STOCKS]);
  });

  /**
   * A holding nobody has said the kind of has to have somewhere to live, or the tabs make it
   * unreachable — and unreachable means it cannot be given the type it is missing. The allocation card
   * already asks for these; this is where somebody goes to answer.
   */
  it('offers a tab for what has no kind at all', () => {
    expect(wealthTabs([held(ASSET_TYPE.ETF), held()], false)).toEqual([
      ASSET_TYPE.ETF,
      UNTYPED_TAB,
    ]);
  });

  it('offers the untyped tab last, since it is a to-do rather than a holding kind', () => {
    expect(wealthTabs([held(), held(ASSET_TYPE.CASH)], false)).toEqual([
      ASSET_TYPE.CASH,
      UNTYPED_TAB,
    ]);
  });

  /**
   * Bonds get their tab from there being bonds, not from a position typed as such: the app prices them
   * itself and they are not positions at all.
   */
  it('offers the bonds tab when bonds are held, with no position typed as bonds', () => {
    // In the enum's order, where cash comes before bonds — not in order of prominence.
    expect(wealthTabs([held(ASSET_TYPE.CASH)], true)).toEqual([
      ASSET_TYPE.CASH,
      ASSET_TYPE.BONDS,
    ]);
  });

  it('offers the bonds tab once when both a bond and a position typed as bonds exist', () => {
    expect(wealthTabs([held(ASSET_TYPE.BONDS)], true)).toEqual([ASSET_TYPE.BONDS]);
  });

  /**
   * What is owed is not a kind of asset and has no place in an allocation, so a mortgage does not
   * conjure a "property" tab. It gets its own, because otherwise the tabs would make it unreachable —
   * and a mortgage that cannot be opened is a large figure nobody can correct.
   */
  it('gives what is owed its own tab rather than a kind of its own', () => {
    expect(wealthTabs([owed(ASSET_TYPE.REAL_ESTATE)], false)).toEqual([OWED_TAB]);
  });

  it('offers the owed tab after the kinds and before the untyped to-do', () => {
    expect(wealthTabs([held(ASSET_TYPE.CASH), owed(), held()], false)).toEqual([
      ASSET_TYPE.CASH,
      OWED_TAB,
      UNTYPED_TAB,
    ]);
  });

  it('offers no owed tab where nothing is owed', () => {
    expect(wealthTabs([held(ASSET_TYPE.CASH)], false)).toEqual([ASSET_TYPE.CASH]);
  });

  it('offers nothing at all on an empty account', () => {
    expect(wealthTabs([], false)).toEqual([]);
  });
});
