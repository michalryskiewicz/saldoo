import type { ParseStepResult } from 'papaparse';

/**
 * The same values in both rows, whatever their order and however often each repeats.
 *
 * What a bank's footer row is recognised by, and set semantics is what it has always used — a
 * two-cell `['', '']` and a one-cell `['']` are the same end-of-statement marker. Written out
 * rather than borrowed from a utility library so that describing a statement's format costs
 * nothing but the format: the module used to reach `lodash` for this, which put a CommonJS
 * bundle in the import graph of every file that names a column.
 */
const sameValues = (a: unknown[], b: unknown[]) => {
  const left = new Set(a);
  const right = new Set(b);

  return left.size === right.size && [...left].every((value) => right.has(value));
};

export function createStepCollector(headerRow: unknown[], stopRows: unknown[][]) {
  let collecting = false;
  const collectedRows: unknown[][] = [];

  function arraysStartWith(data: unknown[], expected: unknown[]) {
    // Check if data starts with the expected values (ignoring trailing elements)
    if (data.length < expected.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (data[i] !== expected[i]) return false;
    }
    return true;
  }

  function step(row: ParseStepResult<unknown>) {
    const data = row.data as unknown[];

    // Check header using prefix match to handle variable trailing columns
    if (arraysStartWith(data, headerRow)) {
      collecting = true;
      return;
    }
    if (stopRows.some((stopRow) => sameValues(data, stopRow))) {
      collecting = false;
      return;
    }
    if (collecting) {
      collectedRows.push(data);
    }
  }

  function getRows() {
    return collectedRows;
  }

  return { step, getRows };
}
