import { describe, expect, it } from 'vitest';
import { isValidCcFormat } from '../../../../src/core/validators/cc';

describe('isValidCcFormat — EXPERIMENTAL, format only (SPEC.md §6)', () => {
  it('accepts the documented shape', () => {
    expect(isValidCcFormat('123456789ZZ4')).toBe(true);
    expect(isValidCcFormat('12345678 9 ZZ4')).toBe(true); // spaces ignored
  });

  it('rejects the wrong shape', () => {
    expect(isValidCcFormat('12345678')).toBe(false);
    expect(isValidCcFormat('123456789ZZ')).toBe(false);
    expect(isValidCcFormat('12345678AZZ4')).toBe(false);
  });
});
