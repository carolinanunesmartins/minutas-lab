import { tokenizeParagraphs } from './tokenize';
import { validateDocument } from './validate';
import type { ParseResult, RawParagraph } from './types';

/** Parse a template document (already flattened to per-paragraph text) per SPEC.md §3. */
export function parseTemplate(paragraphs: RawParagraph[]): ParseResult {
  return validateDocument(tokenizeParagraphs(paragraphs));
}

export { renderParagraphs } from './render';
export * from './types';
