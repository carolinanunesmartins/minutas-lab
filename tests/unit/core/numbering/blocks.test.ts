import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTemplate } from '../../../../src/core/tags/parse';
import type { RawParagraph } from '../../../../src/core/tags/types';
import { analyzeBlocks, findHiddenRefs } from '../../../../src/core/numbering/blocks';

function body(...texts: string[]): RawParagraph[] {
  return texts.map((text) => ({ location: 'body' as const, text }));
}

describe('findHiddenRefs', () => {
  it('flags a ref outside the block its target anchor lives in', () => {
    const { paragraphs } = parseTemplate(
      body('{{#se onus}}', 'CLÁUSULA {{cl onus_cl}}', '{{/se}}', 'Ref: {{ref:onus_cl}}'),
    );
    const errors = findHiddenRefs(analyzeBlocks(paragraphs));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe('REF_TARGET_HIDDEN');
  });

  it('does not flag a ref inside the same conditional block as its target', () => {
    const { paragraphs } = parseTemplate(
      body('{{#se onus}}', 'CLÁUSULA {{cl onus_cl}}', 'Ref: {{ref:onus_cl}}', '{{/se}}'),
    );
    expect(findHiddenRefs(analyzeBlocks(paragraphs))).toEqual([]);
  });

  it('does not flag a ref to an always-visible (top-level) anchor', () => {
    const { paragraphs } = parseTemplate(
      body('CLÁUSULA {{cl top}}', '{{#se onus}}', 'Ref: {{ref:top}}', '{{/se}}'),
    );
    expect(findHiddenRefs(analyzeBlocks(paragraphs))).toEqual([]);
  });

  it('flags a ref in the #senao branch when the anchor is in the #se branch', () => {
    const { paragraphs } = parseTemplate(
      body('{{#se onus}}', 'CLÁUSULA {{cl a}}', '{{#senao}}', 'Ref: {{ref:a}}', '{{/se}}'),
    );
    const errors = findHiddenRefs(analyzeBlocks(paragraphs));
    expect(errors).toHaveLength(1);
  });
});

describe('findHiddenRefs — real CPCV template', () => {
  it('has zero hidden-ref errors', () => {
    const source = readFileSync(join(__dirname, '../../../../templates/cpcv/source.txt'), 'utf-8');
    const bodyText = source.split('=== CAMPOS ===')[0] ?? '';
    const paragraphs = bodyText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((text) => ({ location: 'body' as const, text }));
    const { paragraphs: classified } = parseTemplate(paragraphs);
    expect(findHiddenRefs(analyzeBlocks(classified))).toEqual([]);
  });
});
