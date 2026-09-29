// REQ-VAL (SPEC.md §6). Generic IBAN mod-97 check restricted to Portuguese
// IBANs: "PT" + 23 digits (25 chars total).

const PT_IBAN = /^PT\d{23}$/;

function letterToDigits(char: string): string {
  const code = char.charCodeAt(0);
  return code >= 65 && code <= 90 ? String(code - 55) : char;
}

function mod97(numeral: string): number {
  let remainder = 0;
  for (const digit of numeral) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}

export function isValidIbanPt(value: string): boolean {
  if (!PT_IBAN.test(value)) return false;
  const rearranged = value.slice(4) + value.slice(0, 4);
  const numeral = rearranged
    .split('')
    .map(letterToDigits)
    .join('');
  return mod97(numeral) === 1;
}
