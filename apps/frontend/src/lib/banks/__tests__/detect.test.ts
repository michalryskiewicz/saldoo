import { describe, it, expect } from 'vitest';
import { detectParser, type DetectionCandidate } from '../detect';
import type { BankCsvParser } from '../contract';

const parser = (id: string): BankCsvParser => ({
  id,
  displayName: id,
  version: 1,
  encoding: 'cp1250',
  delimiter: ';',
  detect: () => 0,
  parse: () => ({ transactions: [], warnings: [] }),
});

const candidate = (id: string, confidence: number): DetectionCandidate => ({
  parser: parser(id),
  confidence,
  rows: [[id]],
});

describe('detectParser', () => {
  it('chooses the one parser that found its own header intact', () => {
    const detection = detectParser([candidate('ING', 1), candidate('PKOBP', 0.2)]);

    expect(detection.kind).toBe('certain');
    expect(detection.kind === 'certain' && detection.chosen.parser.id).toBe('ING');
  });

  it('asks when two banks are both certain, because only the person knows which they exported', () => {
    const detection = detectParser([candidate('ING', 1), candidate('PKOBP', 1)]);

    expect(detection.kind).toBe('ambiguous');
    expect(detection.kind === 'ambiguous' && detection.options.map((one) => one.parser.id)).toEqual([
      'ING',
      'PKOBP',
    ]);
  });

  it('offers a close match rather than choosing it, since a wrong parser files wrong columns quietly', () => {
    const detection = detectParser([candidate('ING', 0.8), candidate('PKOBP', 0.1)]);

    expect(detection.kind).toBe('ambiguous');
    expect(detection.kind === 'ambiguous' && detection.options).toHaveLength(1);
  });

  it('ranks what it offers, strongest first', () => {
    const detection = detectParser([candidate('ING', 0.6), candidate('PKOBP', 0.9)]);

    expect(detection.kind === 'ambiguous' && detection.options.map((one) => one.parser.id)).toEqual([
      'PKOBP',
      'ING',
    ]);
  });

  it('knows when it does not know', () => {
    expect(detectParser([candidate('ING', 0.3), candidate('PKOBP', 0)]).kind).toBe('unknown');
  });

  it('knows nothing about an empty registry rather than throwing at the import screen', () => {
    expect(detectParser([]).kind).toBe('unknown');
  });
});
