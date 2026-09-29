import type { ClassifiedParagraph, RawParagraph } from './types';

/** Re-escape literal "{{" sequences in plain text so they don't get parsed as a tag on reparse. */
function escapeLiteralBraces(text: string): string {
  return text.replaceAll('{{', '\\{{');
}

/** Inverse of tokenize+classify: turns a classified document back into paragraph text. */
export function renderParagraphs(paragraphs: ClassifiedParagraph[]): RawParagraph[] {
  return paragraphs.map((paragraph) => ({
    location: paragraph.location,
    text: paragraph.nodes
      .map((node) => (node.kind === 'text' ? escapeLiteralBraces(node.text) : `{{${node.raw}}}`))
      .join(''),
  }));
}
