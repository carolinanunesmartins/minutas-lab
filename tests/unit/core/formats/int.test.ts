import { describe, expect, it } from 'vitest';
import { isValidIntPt, parseIntPt } from '../../../../src/core/formats/int';

describe('parseIntPt', () => {
  it('parses plain non-negative integers', () => {
    expect(parseIntPt('8')).toBe(8);
    expect(parseIntPt('30')).toBe(30);
    expect(parseIntPt('0')).toBe(0);
  });

  it('rejects malformed input', () => {
    expect(isValidIntPt('-1')).toBe(false);
    expect(isValidIntPt('1.5')).toBe(false);
    expect(isValidIntPt('abc')).toBe(false);
    expect(isValidIntPt('')).toBe(false);
  });
});
