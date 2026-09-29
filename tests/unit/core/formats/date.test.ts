import { describe, expect, it } from 'vitest';
import { compareIsoDates, formatDatePt, isValidDatePt, parseDatePt, todayIso } from '../../../../src/core/formats/date';

describe('parseDatePt', () => {
  it('parses a valid pt-PT date to ISO', () => {
    expect(parseDatePt('31/01/2027')).toBe('2027-01-31');
  });

  it('rejects an impossible calendar date', () => {
    expect(isValidDatePt('31/04/2026')).toBe(false); // April has 30 days
    expect(isValidDatePt('29/02/2025')).toBe(false); // 2025 is not a leap year
    expect(isValidDatePt('00/01/2026')).toBe(false);
    expect(isValidDatePt('01/13/2026')).toBe(false);
  });

  it('accepts 29 February on a leap year', () => {
    expect(isValidDatePt('29/02/2024')).toBe(true);
  });

  it('rejects malformed input', () => {
    expect(parseDatePt('2026-01-31')).toBeNull();
    expect(parseDatePt('1/1/2026')).toBeNull();
  });
});

describe('formatDatePt', () => {
  it('round-trips with parseDatePt', () => {
    expect(formatDatePt(parseDatePt('05/03/2027') as string)).toBe('05/03/2027');
  });
});

describe('compareIsoDates / todayIso', () => {
  it('orders ISO dates lexicographically', () => {
    expect(compareIsoDates('2026-01-01', '2026-01-02')).toBeLessThan(0);
    expect(compareIsoDates('2026-01-02', '2026-01-01')).toBeGreaterThan(0);
    expect(compareIsoDates('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('formats a Date as ISO', () => {
    expect(todayIso(new Date(2026, 8, 29))).toBe('2026-09-29');
  });
});
