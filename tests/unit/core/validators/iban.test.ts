import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isValidIbanPt } from '../../../../src/core/validators/iban';

describe('isValidIbanPt — SPEC.md §6 vectors', () => {
  it.each(['PT50999946281948219935123', 'PT50999981909378657975468'])('accepts valid IBAN %s', (v) => {
    expect(isValidIbanPt(v)).toBe(true);
  });

  it('rejects an invalid IBAN', () => {
    expect(isValidIbanPt('PT50999946281948219935124')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isValidIbanPt('PT509999462819482199351')).toBe(false); // too short
    expect(isValidIbanPt('ES5000000000000000000000')).toBe(false); // wrong country
  });
});

const digits23 = fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 23, maxLength: 23 }).map((d) => d.join(''));

describe('property: mod-97 invariant', () => {
  it('any accepted IBAN really does satisfy mod 97 = 1', () => {
    fc.assert(
      fc.property(digits23, (digits) => {
        const iban = `PT${digits}`;
        if (isValidIbanPt(iban)) {
          // Move first 4 chars ("PT" + 2 check digits) to the end; "PT" -> "25" "29"
          // per the IBAN letter-to-digit rule (A=10..Z=35).
          const rearranged = `${iban.slice(4)}2529${iban.slice(2, 4)}`;
          let remainder = 0;
          for (const ch of rearranged) remainder = (remainder * 10 + Number(ch)) % 97;
          expect(remainder).toBe(1);
        }
      }),
      { numRuns: 2000 },
    );
  });
});
