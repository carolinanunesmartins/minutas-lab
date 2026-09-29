// REQ-VAL (SPEC.md §6): "CC: 12-char format + Luhn-like checksum; EXPERIMENTAL,
// warning-only until verified." Only the format is checked here — 8 digits +
// 1 check digit + 2 letters (document version) + 1 digit, spaces ignored, e.g.
// "12345678 9 ZZ4". No verified public checksum spec was available to
// implement the Luhn-like digit check without inventing one (AGENTS.md §4
// rule 10 baseline: don't invent unverified algorithms), so callers MUST treat
// a positive result from this module as experimental/warning-only, never error.

export const CC_EXPERIMENTAL = true;

const CC_FORMAT = /^\d{9}[A-Za-z]{2}\d$/;

export function isValidCcFormat(value: string): boolean {
  return CC_FORMAT.test(value.replace(/\s/g, ''));
}
