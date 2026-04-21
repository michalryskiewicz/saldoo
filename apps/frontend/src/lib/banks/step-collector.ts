import type { ParseStepResult } from 'papaparse';
import { isEmpty, xor } from 'lodash';

export function createStepCollector(headerRow: unknown[], stopRows: unknown[][]) {
  let collecting = false;
  const collectedRows: unknown[][] = [];

  function arraysEqual(a: unknown[], b: unknown[]) {
    return isEmpty(xor(a, b));
  }

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
    if (stopRows.some((stopRow) => arraysEqual(data, stopRow))) {
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
