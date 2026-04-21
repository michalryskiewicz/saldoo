import { describe, it, expect } from 'vitest';
import { createStepCollector } from '../step-collector';
import type { ParseStepResult } from 'papaparse';

describe('step-collector', () => {
  describe('createStepCollector', () => {
    it('collects rows after header and before stop row', () => {
      const headerRow = ['Column1', 'Column2', 'Column3'];
      const stopRows = [['End of data']];
      const collector = createStepCollector(headerRow, stopRows);

      const mockSteps: ParseStepResult<unknown>[] = [
        { data: ['Some', 'preamble', 'data'], errors: [], meta: {} as any },
        { data: ['Column1', 'Column2', 'Column3'], errors: [], meta: {} as any },
        { data: ['Row1', 'Data1', 'Value1'], errors: [], meta: {} as any },
        { data: ['Row2', 'Data2', 'Value2'], errors: [], meta: {} as any },
        { data: ['End of data'], errors: [], meta: {} as any },
        { data: ['Should', 'not', 'collect'], errors: [], meta: {} as any },
      ];

      mockSteps.forEach((step) => collector.step(step));
      const rows = collector.getRows();

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual(['Row1', 'Data1', 'Value1']);
      expect(rows[1]).toEqual(['Row2', 'Data2', 'Value2']);
    });

    it('handles header with trailing columns using prefix match', () => {
      const headerRow = ['Col1', 'Col2', 'Col3'];
      const stopRows = [['']];
      const collector = createStepCollector(headerRow, stopRows);

      const mockSteps: ParseStepResult<unknown>[] = [
        { data: ['Col1', 'Col2', 'Col3', 'Col4', 'Col5'], errors: [], meta: {} as any },
        { data: ['Data1', 'Data2', 'Data3', 'Data4', 'Data5'], errors: [], meta: {} as any },
        { data: [''], errors: [], meta: {} as any },
      ];

      mockSteps.forEach((step) => collector.step(step));
      const rows = collector.getRows();

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(['Data1', 'Data2', 'Data3', 'Data4', 'Data5']);
    });

    it('does not collect rows before header', () => {
      const headerRow = ['Header1', 'Header2'];
      const stopRows = [['END']];
      const collector = createStepCollector(headerRow, stopRows);

      const mockSteps: ParseStepResult<unknown>[] = [
        { data: ['Before', 'header'], errors: [], meta: {} as any },
        { data: ['Still', 'before'], errors: [], meta: {} as any },
        { data: ['Header1', 'Header2'], errors: [], meta: {} as any },
        { data: ['After', 'header'], errors: [], meta: {} as any },
        { data: ['END'], errors: [], meta: {} as any },
      ];

      mockSteps.forEach((step) => collector.step(step));
      const rows = collector.getRows();

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(['After', 'header']);
    });

    it('stops collecting at first stop row', () => {
      const headerRow = ['H1'];
      const stopRows = [['STOP1'], ['STOP2']];
      const collector = createStepCollector(headerRow, stopRows);

      const mockSteps: ParseStepResult<unknown>[] = [
        { data: ['H1'], errors: [], meta: {} as any },
        { data: ['Row1'], errors: [], meta: {} as any },
        { data: ['STOP1'], errors: [], meta: {} as any },
        { data: ['Row2'], errors: [], meta: {} as any },
      ];

      mockSteps.forEach((step) => collector.step(step));
      const rows = collector.getRows();

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(['Row1']);
    });

    it('returns empty array when no data collected', () => {
      const headerRow = ['Header'];
      const stopRows = [['END']];
      const collector = createStepCollector(headerRow, stopRows);

      const mockSteps: ParseStepResult<unknown>[] = [
        { data: ['Some', 'data'], errors: [], meta: {} as any },
        { data: ['More', 'data'], errors: [], meta: {} as any },
      ];

      mockSteps.forEach((step) => collector.step(step));
      const rows = collector.getRows();

      expect(rows).toHaveLength(0);
    });

    it('continues collecting if header appears again', () => {
      const headerRow = ['Col'];
      const stopRows = [['END']];
      const collector = createStepCollector(headerRow, stopRows);

      const mockSteps: ParseStepResult<unknown>[] = [
        { data: ['Col'], errors: [], meta: {} as any },
        { data: ['Data1'], errors: [], meta: {} as any },
        { data: ['Col'], errors: [], meta: {} as any },
        { data: ['Data2'], errors: [], meta: {} as any },
        { data: ['END'], errors: [], meta: {} as any },
      ];

      mockSteps.forEach((step) => collector.step(step));
      const rows = collector.getRows();

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual(['Data1']);
      expect(rows[1]).toEqual(['Data2']);
    });
  });
});
