import { describe, it, expect } from 'vitest';
import { createStepCollector } from '../step-collector';
import type { ParseMeta, ParseStepResult } from 'papaparse';

const META: ParseMeta = {
  delimiter: ',',
  linebreak: '\n',
  aborted: false,
  truncated: false,
  cursor: 0,
};

const step = (data: string[]): ParseStepResult<unknown> => ({ data, errors: [], meta: META });

describe('step-collector', () => {
  describe('createStepCollector', () => {
    it('collects rows after header and before stop row', () => {
      const headerRow = ['Column1', 'Column2', 'Column3'];
      const stopRows = [['End of data']];
      const collector = createStepCollector(headerRow, stopRows);

      const mockSteps = [
        step(['Some', 'preamble', 'data']),
        step(['Column1', 'Column2', 'Column3']),
        step(['Row1', 'Data1', 'Value1']),
        step(['Row2', 'Data2', 'Value2']),
        step(['End of data']),
        step(['Should', 'not', 'collect']),
      ];

      mockSteps.forEach((s) => collector.step(s));
      const rows = collector.getRows();

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual(['Row1', 'Data1', 'Value1']);
      expect(rows[1]).toEqual(['Row2', 'Data2', 'Value2']);
    });

    it('handles header with trailing columns using prefix match', () => {
      const headerRow = ['Col1', 'Col2', 'Col3'];
      const stopRows = [['']];
      const collector = createStepCollector(headerRow, stopRows);

      const mockSteps = [
        step(['Col1', 'Col2', 'Col3', 'Col4', 'Col5']),
        step(['Data1', 'Data2', 'Data3', 'Data4', 'Data5']),
        step(['']),
      ];

      mockSteps.forEach((s) => collector.step(s));
      const rows = collector.getRows();

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(['Data1', 'Data2', 'Data3', 'Data4', 'Data5']);
    });

    it('does not collect rows before header', () => {
      const headerRow = ['Header1', 'Header2'];
      const stopRows = [['END']];
      const collector = createStepCollector(headerRow, stopRows);

      const mockSteps = [
        step(['Before', 'header']),
        step(['Still', 'before']),
        step(['Header1', 'Header2']),
        step(['After', 'header']),
        step(['END']),
      ];

      mockSteps.forEach((s) => collector.step(s));
      const rows = collector.getRows();

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(['After', 'header']);
    });

    it('stops collecting at first stop row', () => {
      const headerRow = ['H1'];
      const stopRows = [['STOP1'], ['STOP2']];
      const collector = createStepCollector(headerRow, stopRows);

      const mockSteps = [step(['H1']), step(['Row1']), step(['STOP1']), step(['Row2'])];

      mockSteps.forEach((s) => collector.step(s));
      const rows = collector.getRows();

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(['Row1']);
    });

    it('returns empty array when no data collected', () => {
      const headerRow = ['Header'];
      const stopRows = [['END']];
      const collector = createStepCollector(headerRow, stopRows);

      const mockSteps = [step(['Some', 'data']), step(['More', 'data'])];

      mockSteps.forEach((s) => collector.step(s));
      const rows = collector.getRows();

      expect(rows).toHaveLength(0);
    });

    it('continues collecting if header appears again', () => {
      const headerRow = ['Col'];
      const stopRows = [['END']];
      const collector = createStepCollector(headerRow, stopRows);

      const mockSteps = [
        step(['Col']),
        step(['Data1']),
        step(['Col']),
        step(['Data2']),
        step(['END']),
      ];

      mockSteps.forEach((s) => collector.step(s));
      const rows = collector.getRows();

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual(['Data1']);
      expect(rows[1]).toEqual(['Data2']);
    });
  });
});
