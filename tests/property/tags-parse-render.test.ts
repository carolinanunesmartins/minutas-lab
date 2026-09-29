import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseTemplate, renderParagraphs } from '../../src/core/tags/parse';
import type { ParagraphLocation, RawParagraph } from '../../src/core/tags/types';

const location: fc.Arbitrary<ParagraphLocation> = fc.constantFrom('body', 'header', 'footer');

// Biased alphabet: plain unicode strings rarely exercise the "{{"/"}}"/"\" escaping
// paths, so mix in fragments built from the characters that actually matter to the
// tag grammar (braces, backslash, colon, pipe, lowercase ids, digits).
const templateish = fc
  .array(fc.constantFrom('{{', '}}', '\\', 'a', 'b', '_', '1', ':', '|', ' ', '\n', 'cl', 'se', '/'), {
    maxLength: 24,
  })
  .map((parts) => parts.join(''));

const paragraphText = fc.oneof(fc.string({ maxLength: 40 }), templateish);

const paragraphs: fc.Arbitrary<RawParagraph[]> = fc.array(
  fc.record({ location, text: paragraphText }),
  { maxLength: 8 },
);

describe('property: parse(render(parse(x))) is a fixed point', () => {
  it('holds for arbitrary paragraph text, including tag-shaped fragments', () => {
    fc.assert(
      fc.property(paragraphs, (docs) => {
        const first = parseTemplate(docs);
        const rerendered = renderParagraphs(first.paragraphs);
        const second = parseTemplate(rerendered);
        expect(second.paragraphs).toEqual(first.paragraphs);
        expect(second.errors).toEqual(first.errors);
      }),
      { numRuns: 500 },
    );
  });
});
