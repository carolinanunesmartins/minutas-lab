import type { InlineToken, ParagraphLocation, RawParagraph, TokenizedParagraph } from './types';

const ESCAPED_OPEN = '\\{{';
const OPEN = '{{';
const CLOSE = '}}';

export type SpannedToken =
  | { kind: 'text'; text: string; start: number; end: number }
  | { kind: 'escape'; start: number; end: number }
  | { kind: 'tag'; raw: string; start: number; end: number };

/**
 * Scan a single paragraph's flattened text into text/escape/tag tokens, each
 * carrying its [start, end) character offsets in the source text. An `escape`
 * token is one `\{{` sequence (renders as the 2-char literal "{{"). Shared core
 * for `tokenizeParagraph` (T1.2, offset-free, merges text+escape) and
 * `findTagSpans`/`findEscapeSpans` (T1.3, need offsets to locate spans in the run-map).
 */
export function scanParagraph(text: string): SpannedToken[] {
  const tokens: SpannedToken[] = [];
  let buffer = '';
  let bufferStart = 0;
  let i = 0;

  const flush = (end: number): void => {
    if (buffer.length > 0) {
      tokens.push({ kind: 'text', text: buffer, start: bufferStart, end });
      buffer = '';
    }
  };

  while (i < text.length) {
    if (buffer.length === 0) bufferStart = i;

    if (text.startsWith(ESCAPED_OPEN, i)) {
      flush(i);
      tokens.push({ kind: 'escape', start: i, end: i + ESCAPED_OPEN.length });
      i += ESCAPED_OPEN.length;
      continue;
    }
    if (text.startsWith(OPEN, i)) {
      const closeIndex = text.indexOf(CLOSE, i + OPEN.length);
      if (closeIndex === -1) {
        // Unterminated tag: keep as literal text from here on so it is
        // preserved verbatim (round-trips) and reported by the classifier.
        buffer += text.slice(i);
        i = text.length;
        continue;
      }
      flush(i);
      const tagStart = i;
      const tagEnd = closeIndex + CLOSE.length;
      const raw = text.slice(i + OPEN.length, closeIndex).trim();
      tokens.push({ kind: 'tag', raw, start: tagStart, end: tagEnd });
      i = tagEnd;
      continue;
    }
    buffer += text[i];
    i += 1;
  }
  flush(i);
  return tokens;
}

/** Tokenize a single paragraph's flattened text into literal-text and tag tokens. */
export function tokenizeParagraph(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let merged = '';
  for (const t of scanParagraph(text)) {
    if (t.kind === 'tag') {
      if (merged.length > 0) {
        tokens.push({ kind: 'text', text: merged });
        merged = '';
      }
      tokens.push({ kind: 'tag', raw: t.raw });
    } else if (t.kind === 'escape') {
      merged += OPEN;
    } else {
      merged += t.text;
    }
  }
  if (merged.length > 0) tokens.push({ kind: 'text', text: merged });
  return tokens;
}

export function tokenizeParagraphs(paragraphs: RawParagraph[]): TokenizedParagraph[] {
  return paragraphs.map(
    (p): TokenizedParagraph => ({
      location: p.location satisfies ParagraphLocation,
      tokens: tokenizeParagraph(p.text),
    }),
  );
}

/** Tag tokens only, with their [start, end) offsets in the paragraph text — for T1.3. */
export function findTagSpans(text: string): { raw: string; start: number; end: number }[] {
  return scanParagraph(text)
    .filter((t): t is Extract<SpannedToken, { kind: 'tag' }> => t.kind === 'tag')
    .map(({ raw, start, end }) => ({ raw, start, end }));
}

/** Escape-sequence (`\{{`) spans only, with offsets — for T1.3 (unescaping on output). */
export function findEscapeSpans(text: string): { start: number; end: number }[] {
  return scanParagraph(text)
    .filter((t): t is Extract<SpannedToken, { kind: 'escape' }> => t.kind === 'escape')
    .map(({ start, end }) => ({ start, end }));
}
