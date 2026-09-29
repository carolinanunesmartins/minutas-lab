// REQ-VAL (SPEC.md §6). NIF/NIPC share the same 9-digit checksum: weights
// 9..2 over the first 8 digits; check digit c = 11 - (sum mod 11); c >= 10 -> 0.
// Prefix lists are unverified per SPEC.md §13 and are intentionally not enforced.

const NINE_DIGITS = /^\d{9}$/;

function hasValidChecksum(value: string): boolean {
  const digits = value.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 8; i += 1) {
    sum += (digits[i] as number) * (9 - i);
  }
  const remainder = sum % 11;
  const expected = remainder < 2 ? 0 : 11 - remainder;
  return expected === digits[8];
}

export function isValidNif(value: string): boolean {
  return NINE_DIGITS.test(value) && hasValidChecksum(value);
}

export function isValidNipc(value: string): boolean {
  return NINE_DIGITS.test(value) && hasValidChecksum(value);
}
