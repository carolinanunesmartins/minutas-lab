// REQ-VAL (SPEC.md §6). Input dd/mm/aaaa, stored ISO (yyyy-mm-dd); real
// calendar dates only (rejects e.g. 31/04/2026, 29/02 on non-leap years).

const PT_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1] as number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parse a "dd/mm/aaaa" string into an ISO "yyyy-mm-dd" string, or null if invalid. */
export function parseDatePt(input: string): string | null {
  const m = PT_DATE.exec(input);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Format an ISO "yyyy-mm-dd" string as "dd/mm/aaaa", or null if malformed. */
export function formatDatePt(iso: string): string | null {
  const m = ISO_DATE.exec(iso);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function isValidDatePt(input: string): boolean {
  return parseDatePt(input) !== null;
}

export function compareIsoDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function todayIso(now: Date): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}
