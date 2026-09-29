// REQ-VAL (SPEC.md §6). Input pt-PT ("1.234,56" or "1234,56" or "1234"),
// stored as an integer number of cents; output "1.234,56 €" with an NBSP
// before the euro sign.

const NBSP = ' ';
const PT_EUR = /^(\d+|\d{1,3}(?:\.\d{3})+)(?:,(\d{2}))?$/;

/** Parse a pt-PT euro amount into an integer number of cents, or null if malformed. */
export function parseEurPt(input: string): number | null {
  const m = PT_EUR.exec(input.trim());
  if (!m) return null;
  const whole = (m[1] as string).replaceAll('.', '');
  const cents = m[2] ?? '00';
  return Number(whole) * 100 + Number(cents);
}

/** Format an integer number of cents as pt-PT "1.234,56 €". */
export function formatEurPt(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const remainder = abs % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}${grouped},${String(remainder).padStart(2, '0')}${NBSP}€`;
}

export function isValidEurPt(input: string): boolean {
  return parseEurPt(input) !== null;
}
