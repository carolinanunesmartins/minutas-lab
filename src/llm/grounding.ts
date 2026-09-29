import type { TagType } from '../core/tags/types';
import type { RawExtractProposal } from './types';

// REQ-LLM (SPEC.md §10): "quote MUST be a substring of input after whitespace
// normalisation; for typed fields, digits(value) MUST appear in digits(quote);
// otherwise proposal rejected and counted."

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function digitsOnly(s: string): string {
  return s.replace(/\D+/g, '');
}

const TYPED = new Set<TagType>(['nif', 'nipc', 'iban', 'cc', 'data', 'eur', 'int']);

export interface GroundingResult {
  /** The model proposed no value at all — not a fabrication, just nothing to ground. */
  abstained: boolean;
  grounded: boolean;
}

/** Check one field's proposal against the source text it was extracted from. */
export function checkGrounding(proposal: RawExtractProposal, sourceText: string, type: TagType): GroundingResult {
  if (proposal.value === null) {
    return { abstained: true, grounded: true };
  }
  if (proposal.quote === null) {
    return { abstained: false, grounded: false };
  }

  const normalizedSource = normalizeWhitespace(sourceText);
  const normalizedQuote = normalizeWhitespace(proposal.quote);
  if (normalizedQuote.length === 0 || !normalizedSource.includes(normalizedQuote)) {
    return { abstained: false, grounded: false };
  }

  if (TYPED.has(type)) {
    const valueDigits = digitsOnly(proposal.value);
    const quoteDigits = digitsOnly(proposal.quote);
    if (!quoteDigits.includes(valueDigits)) {
      return { abstained: false, grounded: false };
    }
  }

  return { abstained: false, grounded: true };
}
