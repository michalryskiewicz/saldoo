import { ASSET_TYPE } from '@/constant.ts';

/** What somebody meant to hold, as whole per cent per kind. */
export type AllocationTarget = Partial<Record<ASSET_TYPE, number>>;

export type AllocationPart = {
  assetType: ASSET_TYPE;
  /** In the currency the screen reads, so the parts add up to what is held. */
  value: number;
  /** Whole per cent of the *typed* wealth. */
  share: number;
  target?: number;
  /** Signed distance from the target: over reads differently from under. Absent without a target. */
  drift?: number;
};

export type Allocation = {
  parts: AllocationPart[];
  /**
   * What is held under no type at all.
   *
   * Beside the parts rather than inside them — see below. Nought once everything has been said of.
   */
  untyped: number;
};

type TypedHolding = { value: number; assetType?: ASSET_TYPE };

/**
 * What kinds of thing somebody's wealth is, as shares, and how far that is from what they meant.
 *
 * The reading two people with the same net worth need in order to see that they are not in remotely
 * the same position. The share is the fact, not the amount.
 *
 * **Shares are of the typed wealth, and what is untyped is reported beside them.** Both alternatives
 * are worse. Counted in, a half-classified account reports every kind as far below its target — true
 * of the wealth and useless as a reading of the allocation, since the gap is bookkeeping rather than
 * a position. Left out in silence, the percentages describe a fraction of somebody's money as though
 * it were all of it. So they describe the part that has been classified, and say how much has not.
 *
 * A kind that was aimed for and never bought is listed at nought — it is the most useful row on the
 * screen, and leaving it out would hide exactly the gap the target was set to reveal.
 */
export const allocation = (
  holdings: TypedHolding[],
  target: AllocationTarget
): Allocation => {
  const worth = new Map<ASSET_TYPE, number>();
  let untyped = 0;

  for (const holding of holdings) {
    if (!holding.value) continue;

    if (!holding.assetType) {
      untyped = Number((untyped + holding.value).toFixed(2));
      continue;
    }

    worth.set(
      holding.assetType,
      Number(((worth.get(holding.assetType) ?? 0) + holding.value).toFixed(2))
    );
  }

  // Aimed at but never bought, so the gap is visible rather than merely absent.
  for (const aimed of Object.keys(target) as ASSET_TYPE[]) {
    if (!worth.has(aimed)) worth.set(aimed, 0);
  }

  const total = [...worth.values()].reduce((sum, value) => sum + value, 0);

  if (!total) return { parts: [], untyped };

  return {
    parts: [...worth.entries()]
      .map(([assetType, value]) => {
        const share = Math.round((value / total) * 100);
        const aim = target[assetType];

        return {
          assetType,
          value,
          share,
          target: aim,
          drift: aim === undefined ? undefined : share - aim,
        };
      })
      .sort((a, b) => b.value - a.value),
    untyped,
  };
};

/**
 * What a target adds up to, ignoring the kinds left blank.
 *
 * Shown while somebody fills the form in, because a rule that speaks only on submit leaves them
 * hunting for the row that is wrong. A target has to come to a hundred to mean anything — shares of
 * something are not shares of it otherwise.
 */
export const targetSum = (target: Record<string, number | undefined>): number =>
  Object.values(target).reduce<number>((sum, share) => sum + (share ?? 0), 0);

/** An empty target is as valid as a complete one: it means nobody has set one, not that it is wrong. */
export const isTargetUsable = (target: Record<string, number | undefined>): boolean => {
  const sum = targetSum(target);

  return sum === 0 || sum === 100;
};

/**
 * A target with the blanks dropped.
 *
 * A kind somebody left empty is a kind they did not aim at, and storing it as nought would say
 * something else entirely: that they meant to hold none of it, which the allocation would then report
 * a drift against. Absent and nought are different answers and this keeps them apart.
 */
export const onlyChosenShares = (
  target: Record<string, number | undefined>
): AllocationTarget =>
  Object.fromEntries(
    Object.entries(target).filter(([, share]) => share !== undefined && share > 0)
  ) as AllocationTarget;
