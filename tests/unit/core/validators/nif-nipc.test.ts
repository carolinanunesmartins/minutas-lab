import { describe, expect, it } from 'vitest';
import { isValidNif, isValidNipc } from '../../../../src/core/validators/nif-nipc';

describe('isValidNif — SPEC.md §6 vectors', () => {
  it.each(['252601815', '259083011'])('accepts valid NIF %s', (v) => {
    expect(isValidNif(v)).toBe(true);
  });

  it('rejects an invalid NIF', () => {
    expect(isValidNif('296030822')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isValidNif('12345678')).toBe(false);
    expect(isValidNif('2526018150')).toBe(false);
    expect(isValidNif('25260181a')).toBe(false);
  });
});

describe('isValidNipc — SPEC.md §6 vectors', () => {
  it.each(['566131862', '509139094'])('accepts valid NIPC %s', (v) => {
    expect(isValidNipc(v)).toBe(true);
  });

  it('rejects an invalid NIPC', () => {
    expect(isValidNipc('566131863')).toBe(false);
  });
});
