/**
 * What each column becomes when there is no room for a table.
 *
 * Below `md` a row stops being a row. Eight columns cannot be both dense and readable at 390px,
 * and a table that scrolls sideways hides most of itself behind a gesture nothing announces — so
 * the row is rebuilt as a line of text with one figure on it. That means every column has to say
 * what it is *for*, not just how wide it is:
 *
 * - `title` — what the record is called. Defaulted from `grow`, which already marks the column
 *   that names the record, so no table has to say this twice.
 * - `figure` — the one number worth seeing without opening anything.
 * - `detail` — a supporting word, shown small under the title. The default.
 * - `actions` — controls, kept out of the text.
 * - `hidden` — carried by the table and not worth the space on a phone.
 */

export type MobileRole = 'title' | 'figure' | 'detail' | 'actions' | 'hidden';

type CellLike = {
  column: { columnDef: { meta?: { mobile?: MobileRole; grow?: boolean } } };
  getValue?: () => unknown;
};

export const mobileRoleOf = (cell: CellLike): MobileRole => {
  const meta = cell.column.columnDef.meta;

  return meta?.mobile ?? (meta?.grow ? 'title' : 'detail');
};

/**
 * Whether this record has anything to say in this column.
 *
 * Asked of details only, and the reason is punctuation. Details are strung together with a
 * separator between them, so a column this record has no value for does not merely take up no
 * room — it contributes a middot, and three unset columns leave the supporting line reading
 * " · · · " with no words in it at all.
 *
 * A zero stays: it is an answer rather than the absence of one. A column with no accessor cannot
 * be asked, and is kept — the table may well be rendering it from the record itself.
 */
const hasSomethingToSay = (cell: CellLike): boolean => {
  if (!cell.getValue) return true;

  const value = cell.getValue();

  return value !== undefined && value !== null && value !== '';
};

export const groupCellsForPhone = <TCell extends CellLike>(cells: TCell[]) => ({
  title: cells.find((cell) => mobileRoleOf(cell) === 'title'),
  figure: cells.find((cell) => mobileRoleOf(cell) === 'figure'),
  details: cells.filter((cell) => mobileRoleOf(cell) === 'detail' && hasSomethingToSay(cell)),
  actions: cells.filter((cell) => mobileRoleOf(cell) === 'actions'),
});
