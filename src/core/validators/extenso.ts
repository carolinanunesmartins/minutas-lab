// REQ-VAL (SPEC.md §6): pt-PT number-to-words ("extenso"), euro amounts, and
// clause ordinals (REQ-NUM, for M3's numbering engine to reuse).
//
// Grouping rule: split into milhões / mil / unidades (each 0-999). "e" is
// inserted before the *last* non-empty group iff it is <100 or an exact
// multiple of 100 ("duzentos mil e um", "duzentos mil e cem", but
// "duzentos mil, cento e cinquenta" — no "e" between groups otherwise).
// "cem" is exact-hundred only; "cento e X" for 101-199. "mil", never "um mil".
// Multi-group remainder edge cases beyond the SPEC.md §6 test vectors are
// unverified — flagged there for native review, and here by the same caveat.

const UNITS = [
  'zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove',
] as const;
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'] as const;
const HUNDREDS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos',
] as const;

/** 0-999 -> words. */
function groupToWords(n: number): string {
  if (n === 100) return 'cem';
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(HUNDREDS[hundreds] as string);
  if (rest > 0) {
    if (rest < 20) {
      parts.push(UNITS[rest] as string);
    } else {
      const tens = Math.floor(rest / 10);
      const units = rest % 10;
      parts.push(units > 0 ? `${TENS[tens]} e ${UNITS[units]}` : (TENS[tens] as string));
    }
  }
  return parts.join(' e ');
}

/** Any non-negative integer -> pt-PT words. */
export function numberToWords(n: number): string {
  if (n === 0) return 'zero';
  const millions = Math.floor(n / 1_000_000);
  const remainder = n % 1_000_000;
  const thousands = Math.floor(remainder / 1000);
  const units = remainder % 1000;

  const parts: string[] = [];
  if (millions > 0) parts.push(millions === 1 ? 'um milhão' : `${groupToWords(millions)} milhões`);
  if (thousands > 0) parts.push(thousands === 1 ? 'mil' : `${groupToWords(thousands)} mil`);
  if (units > 0) parts.push(groupToWords(units));

  let result = parts[0] as string;
  for (let i = 1; i < parts.length; i += 1) {
    const isLast = i === parts.length - 1;
    const joiner = isLast && (units < 100 || units % 100 === 0) ? ' e ' : ' ';
    result += joiner + parts[i];
  }
  return result;
}

/** Integer cents -> "X euro(s)[ e Y cêntimo(s)]". */
export function eurosToWords(cents: number): string {
  const euros = Math.floor(cents / 100);
  const centimos = cents % 100;
  let result = `${numberToWords(euros)} ${euros === 1 ? 'euro' : 'euros'}`;
  if (centimos > 0) {
    result += ` e ${numberToWords(centimos)} ${centimos === 1 ? 'cêntimo' : 'cêntimos'}`;
  }
  return result;
}

// REQ-NUM: ordinal clause names. 1-20 are the literal SPEC.md §4 list
// (verified). Beyond 20, composed algorithmically from standard pt-PT
// ordinal tens — not enumerated in SPEC.md, so treat as unverified/best-effort.
const ORDINALS_1_TO_20 = [
  'PRIMEIRA', 'SEGUNDA', 'TERCEIRA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÉTIMA', 'OITAVA', 'NONA', 'DÉCIMA',
  'DÉCIMA PRIMEIRA', 'DÉCIMA SEGUNDA', 'DÉCIMA TERCEIRA', 'DÉCIMA QUARTA', 'DÉCIMA QUINTA',
  'DÉCIMA SEXTA', 'DÉCIMA SÉTIMA', 'DÉCIMA OITAVA', 'DÉCIMA NONA', 'VIGÉSIMA',
] as const;
const ORDINAL_TENS = [
  '', '', 'VIGÉSIMA', 'TRIGÉSIMA', 'QUADRAGÉSIMA', 'QUINQUAGÉSIMA', 'SEXAGÉSIMA', 'SEPTUAGÉSIMA', 'OCTOGÉSIMA', 'NONAGÉSIMA',
] as const;

/** 1-based ordinal clause name in caps ("PRIMEIRA", "SEGUNDA", ... ; SPEC.md §4). */
export function clauseOrdinal(n: number): string {
  if (n < 1) throw new RangeError('clauseOrdinal expects a 1-based positive integer.');
  if (n <= 20) return ORDINALS_1_TO_20[n - 1] as string;
  const tens = Math.floor(n / 10);
  const units = n % 10;
  if (tens > 9) throw new RangeError('clauseOrdinal only supports up to 99 (unverified beyond SPEC.md §4 anyway).');
  return units === 0 ? (ORDINAL_TENS[tens] as string) : `${ORDINAL_TENS[tens]} ${ORDINALS_1_TO_20[units - 1]}`;
}
