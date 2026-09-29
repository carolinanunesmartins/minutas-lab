import { describe, expect, it } from 'vitest';
import { formatEurPt, parseEurPt } from '../../../../src/core/formats/eur';

describe('parseEurPt', () => {
  it('parses grouped and ungrouped amounts', () => {
    expect(parseEurPt('1.234,56')).toBe(123456);
    expect(parseEurPt('1234,56')).toBe(123456);
    expect(parseEurPt('1234')).toBe(123400);
    expect(parseEurPt('235000,00')).toBe(23500000);
  });

  it('rejects malformed input', () => {
    expect(parseEurPt('1.23,45')).toBeNull(); // bad grouping
    expect(parseEurPt('1,234.56')).toBeNull(); // en-US format
    expect(parseEurPt('abc')).toBeNull();
  });
});

describe('formatEurPt', () => {
  it('formats cents as grouped pt-PT with NBSP + €', () => {
    expect(formatEurPt(123456)).toBe('1.234,56 €');
    expect(formatEurPt(23500000)).toBe('235.000,00 €');
    expect(formatEurPt(0)).toBe('0,00 €');
  });

  it('round-trips with parseEurPt', () => {
    const cents = parseEurPt('1.234,56');
    expect(formatEurPt(cents as number)).toBe('1.234,56 €');
  });
});
