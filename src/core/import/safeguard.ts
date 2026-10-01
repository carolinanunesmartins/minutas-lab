// M8 safeguard: the importer is for blank minutas. If the text contains
// checksum-valid identifiers it is probably a *filled* contract, so callers
// should warn the user (the importer is for blank minutas only).
import { isValidIbanPt } from '../validators/iban';
import { isValidNif } from '../validators/nif-nipc';

export interface SensitiveFindings {
  nif: number;
  iban: number;
  email: number;
}

const NINE_DIGITS = /(?<![\d.])\d{9}(?![\d])/g;
const IBAN_PT = /PT\d{2}(?:\s?\d){21}/gi;
const EMAIL = /[^\s@<>()[\]]+@[^\s@<>()[\]]+\.[A-Za-z]{2,}/g;

export function findSensitive(text: string): SensitiveFindings {
  let nif = 0;
  for (const m of text.matchAll(NINE_DIGITS)) if (isValidNif(m[0])) nif += 1;
  let iban = 0;
  for (const m of text.matchAll(IBAN_PT)) if (isValidIbanPt(m[0].replace(/\s/g, '').toUpperCase())) iban += 1;
  const email = Array.from(text.matchAll(EMAIL)).length;
  return { nif, iban, email };
}

export function looksFilled(f: SensitiveFindings): boolean {
  return f.nif > 0 || f.iban > 0 || f.email > 0;
}
