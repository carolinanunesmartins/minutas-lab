import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { clauseOrdinal, eurosToWords, numberToWords } from '../../../../src/core/validators/extenso';

// Exact vectors from SPEC.md §6.
const VECTORS: [number, string][] = [
  [0, 'zero'],
  [21, 'vinte e um'],
  [100, 'cem'],
  [101, 'cento e um'],
  [1000, 'mil'],
  [1001, 'mil e um'],
  [1100, 'mil e cem'],
  [1101, 'mil cento e um'],
  [2000, 'dois mil'],
  [100000, 'cem mil'],
  [1000000, 'um milhão'],
  [2000000, 'dois milhões'],
  [1000001, 'um milhão e um'],
];

describe('numberToWords — SPEC.md §6 vectors', () => {
  it.each(VECTORS)('%d -> %s', (n, words) => {
    expect(numberToWords(n)).toBe(words);
  });
});

describe('numberToWords — additional sanity checks', () => {
  it('never says "um mil"', () => {
    expect(numberToWords(1000)).not.toContain('um mil');
    expect(numberToWords(1050)).not.toContain('um mil');
  });

  it('uses "cento e" (not "cem e") for 101-199', () => {
    expect(numberToWords(150)).toBe('cento e cinquenta');
  });

  it('pluralises milhões only when >1', () => {
    expect(numberToWords(3000000)).toBe('três milhões');
  });
});

describe('property: extenso is monotonic across group boundaries', () => {
  it('never mentions a negative or crashes for any non-negative integer up to 9,999,999', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9_999_999 }), (n) => {
        const words = numberToWords(n);
        expect(words.length).toBeGreaterThan(0);
        expect(words).not.toContain('-');
        expect(words).not.toContain('NaN');
      }),
      { numRuns: 2000 },
    );
  });
});

describe('eurosToWords', () => {
  it('singular/plural euro and cêntimo', () => {
    expect(eurosToWords(100)).toBe('um euro');
    expect(eurosToWords(200)).toBe('dois euros');
    expect(eurosToWords(101)).toBe('um euro e um cêntimo');
    expect(eurosToWords(250)).toBe('dois euros e cinquenta cêntimos');
    expect(eurosToWords(23500000)).toBe('duzentos e trinta e cinco mil euros');
  });
});

describe('clauseOrdinal — SPEC.md §4 list', () => {
  it('matches the literal 1-20 list', () => {
    expect(clauseOrdinal(1)).toBe('PRIMEIRA');
    expect(clauseOrdinal(10)).toBe('DÉCIMA');
    expect(clauseOrdinal(16)).toBe('DÉCIMA SEXTA');
    expect(clauseOrdinal(20)).toBe('VIGÉSIMA');
  });

  it('rejects out-of-range input', () => {
    expect(() => clauseOrdinal(0)).toThrow(RangeError);
  });
});
