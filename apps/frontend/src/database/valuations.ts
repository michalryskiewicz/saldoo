import { v4 as uuidv4 } from 'uuid';
import type { Currency } from '@/constant.ts';
import { documentSession } from '@/database/document/document.container.ts';
import { outbox } from '@/database/document/outbox.container.ts';
import { setLastUpdated } from '@/database/meta.ts';

/**
 * What a holding was said to be worth, on a day.
 *
 * The position carries one value and one date — what it is worth *now* — and that is the right
 * shape for the question every screen asks it. It is also the reason nothing could answer the next
 * question: a re-valuation overwrote the only record of the last one, so a holding could be seen but
 * never compared with itself. Growth, real return, and "your cover fell because the account did"
 * are all the same missing fact.
 *
 * **Its own record rather than a list on the position.** The document codec translates date fields
 * at the top level of a row and nowhere else, so a `Date` nested inside an array reaches Yjs
 * unencoded, crosses the wire as `{}`, and reads back perfectly on the device that wrote it — a
 * failure that only appears on the second device. See `record-codec.ts`.
 *
 * **Append-only.** A valuation is something somebody said on a day; a correction is a new saying,
 * not an edit of the old one. Nothing here updates or deletes, which also means two devices writing
 * their own history can never disagree about a row — they only ever both have more of them.
 *
 * It carries its own currency, because a holding's may be changed and what was said in złoty stays
 * said in złoty.
 */
export type DBValuation = {
  id: string;
  createdAt: Date;
  positionId: string;
  value: number;
  currency: Currency;
  /** The day the person said it was worth this, which is not the day they said so. */
  valuedOn: Date;
};

export type ValuationDraft = Omit<DBValuation, 'id' | 'createdAt'>;

/**
 * Writes down what a holding is worth, beside what it was worth before.
 *
 * Silent by design — no toast. It rides along with saving a holding, which announces itself, and a
 * second notice for the bookkeeping behind the first would read as though two things had happened.
 *
 * The caller is not told whether this landed. The holding is the thing the person was saving and it
 * has already been stored by now; failing their edit because its history could not be filed would
 * lose the number they actually typed, and history that is missing a row is worth more than that.
 */
export const addDBValuation = async (draft: ValuationDraft): Promise<void> => {
  try {
    await documentSession.put('valuations', { id: uuidv4(), createdAt: new Date(), ...draft });
    await setLastUpdated();
    outbox.markDirty();
  } catch (e) {
    console.error(e);
  }
};
