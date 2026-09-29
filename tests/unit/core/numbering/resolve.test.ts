import { describe, expect, it } from 'vitest';
import { parseTemplate } from '../../../../src/core/tags/parse';
import type { ClassifiedParagraph, RawParagraph } from '../../../../src/core/tags/types';
import { resolveNumbering, resolveVisibility } from '../../../../src/core/numbering/resolve';

function body(...texts: string[]): RawParagraph[] {
  return texts.map((text) => ({ location: 'body' as const, text }));
}

/** Key for the (0-based) nth tag node in a paragraph — avoids hardcoding raw node indices. */
function tagKey(paragraphs: ClassifiedParagraph[], paragraphIndex: number, tagOccurrence = 0): string {
  const paragraph = paragraphs[paragraphIndex];
  if (!paragraph) throw new Error(`no paragraph ${paragraphIndex}`);
  let seen = 0;
  for (const [nodeIndex, node] of paragraph.nodes.entries()) {
    if (node.kind !== 'tag') continue;
    if (seen === tagOccurrence) return `${paragraphIndex}:${nodeIndex}`;
    seen += 1;
  }
  throw new Error(`no tag #${tagOccurrence} in paragraph ${paragraphIndex}`);
}

describe('resolveVisibility', () => {
  it('hides paragraphs inside a falsy block and shows them inside a truthy one', () => {
    const { paragraphs } = parseTemplate(body('{{#se onus}}', 'texto onus', '{{/se}}', 'sempre'));
    expect(resolveVisibility(paragraphs, { onus: false })).toEqual([false, false, false, true]);
    expect(resolveVisibility(paragraphs, { onus: true })).toEqual([false, true, false, true]);
  });

  it('handles #senao', () => {
    const { paragraphs } = parseTemplate(body('{{#se x}}', 'sim', '{{#senao}}', 'não', '{{/se}}'));
    expect(resolveVisibility(paragraphs, { x: true })).toEqual([false, true, false, false, false]);
    expect(resolveVisibility(paragraphs, { x: false })).toEqual([false, false, false, true, false]);
  });
});

describe('resolveNumbering — hidden blocks do not consume numbers', () => {
  const doc = body(
    'CLÁUSULA {{cl a}}',
    '{{pt}}. primeiro ponto',
    '{{#se onus}}',
    '{{pt}}. ponto condicional',
    '{{/se}}',
    '{{pt}}. terceiro ponto',
    'CLÁUSULA {{cl b}}',
    '{{pt}}. outro',
  );

  it('when the block is hidden, numbering skips straight over it', () => {
    const { paragraphs } = parseTemplate(doc);
    const result = resolveNumbering(paragraphs, { onus: false });
    expect(result.markerText.get(tagKey(paragraphs, 0))).toBe('PRIMEIRA'); // cl a
    expect(result.markerText.get(tagKey(paragraphs, 1))).toBe('1');
    expect(result.markerText.get(tagKey(paragraphs, 5))).toBe('2'); // "terceiro ponto" becomes pt 2, not 3
    expect(result.markerText.get(tagKey(paragraphs, 6))).toBe('SEGUNDA'); // cl b
    expect(result.markerText.get(tagKey(paragraphs, 7))).toBe('1');
  });

  it('when the block is visible, it consumes a number', () => {
    const { paragraphs } = parseTemplate(doc);
    const result = resolveNumbering(paragraphs, { onus: true });
    expect(result.markerText.get(tagKey(paragraphs, 3))).toBe('2'); // "ponto condicional"
    expect(result.markerText.get(tagKey(paragraphs, 5))).toBe('3'); // "terceiro ponto"
  });
});

describe('resolveNumbering — {{ref:id}} display text', () => {
  it('omits the clause when the ref is in the same clause as its target', () => {
    const doc = body('CLÁUSULA {{cl a}}', '{{pt alvo}}. alvo', 'Ref: {{ref:alvo}}');
    const { paragraphs } = parseTemplate(doc);
    const result = resolveNumbering(paragraphs, {});
    expect(result.refText.get(tagKey(paragraphs, 2))).toBe('n.º 1');
  });

  it('includes the clause name when the ref is in a different clause', () => {
    const doc = body('CLÁUSULA {{cl a}}', '{{pt alvo}}. alvo', 'CLÁUSULA {{cl b}}', 'Ref: {{ref:alvo}}');
    const { paragraphs } = parseTemplate(doc);
    const result = resolveNumbering(paragraphs, {});
    expect(result.refText.get(tagKey(paragraphs, 3))).toBe('n.º 1 da Cláusula Primeira');
  });

  it('refs a clause anchor as "Cláusula <Ordinal>"', () => {
    const doc = body('CLÁUSULA {{cl alvo}}', 'Ref: {{ref:alvo}}');
    const { paragraphs } = parseTemplate(doc);
    const result = resolveNumbering(paragraphs, {});
    expect(result.refText.get(tagKey(paragraphs, 1))).toBe('Cláusula Primeira');
  });
});
