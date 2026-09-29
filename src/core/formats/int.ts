// REQ-VAL (SPEC.md §6). Plain non-negative integers (day counts, etc).

const PT_INT = /^\d+$/;

export function parseIntPt(input: string): number | null {
  const trimmed = input.trim();
  if (!PT_INT.test(trimmed)) return null;
  return Number(trimmed);
}

export function isValidIntPt(input: string): boolean {
  return parseIntPt(input) !== null;
}
