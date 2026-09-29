import { describe, expect, it } from 'vitest';
import { parseTemplate, renderParagraphs } from '../../../../src/core/tags/parse';
import type { RawParagraph, TagErrorCode } from '../../../../src/core/tags/types';

function body(...texts: string[]): RawParagraph[] {
  return texts.map((text) => ({ location: 'body', text }));
}

function codes(result: ReturnType<typeof parseTemplate>): TagErrorCode[] {
  return result.errors.map((e) => e.code);
}

describe('parseTemplate — value tags', () => {
  it('parses a plain default-type tag', () => {
    const result = parseTemplate(body('Olá, {{nome}}.'));
    expect(result.errors).toEqual([]);
    const tag = result.paragraphs[0]?.nodes.find((n) => n.kind === 'tag');
    expect(tag).toMatchObject({ node: { kind: 'value', id: 'nome', type: 'text', explicitType: false } });
  });

  it('parses a typed tag with a modifier', () => {
    const result = parseTemplate(body('{{preco:eur|extenso}}'));
    expect(result.errors).toEqual([]);
    expect(result.paragraphs[0]?.nodes[0]).toMatchObject({
      node: { kind: 'value', id: 'preco', type: 'eur', explicitType: true, modifier: 'extenso' },
    });
  });
});

describe('parseTemplate — error codes (SPEC.md §3)', () => {
  it('TAG_SYNTAX on malformed content', () => {
    expect(codes(parseTemplate(body('{{123bad}}')))).toContain('TAG_SYNTAX');
    expect(codes(parseTemplate(body('{{}}')))).toContain('TAG_SYNTAX');
  });

  it('TAG_UNKNOWN_TYPE on an unrecognised type', () => {
    expect(codes(parseTemplate(body('{{x:banana}}')))).toContain('TAG_UNKNOWN_TYPE');
  });

  it('TAG_TYPE_CONFLICT when the same id is used with two types', () => {
    expect(codes(parseTemplate(body('{{x:eur}}', '{{x:int}}')))).toContain('TAG_TYPE_CONFLICT');
  });

  it('does not conflict when the same id repeats the same type', () => {
    expect(codes(parseTemplate(body('{{x:eur}}', '{{x:eur}}')))).not.toContain('TAG_TYPE_CONFLICT');
  });

  it('TAG_BLOCK_UNCLOSED when a block is never closed', () => {
    expect(codes(parseTemplate(body('{{#se onus}}', 'texto')))).toContain('TAG_BLOCK_UNCLOSED');
  });

  it('TAG_BLOCK_MISMATCH on a stray close', () => {
    expect(codes(parseTemplate(body('{{/se}}')))).toContain('TAG_BLOCK_MISMATCH');
  });

  it('TAG_BLOCK_MISMATCH on a wrongly-nested close', () => {
    expect(codes(parseTemplate(body('{{#a}}', '{{#b}}', '{{/a}}', '{{/b}}')))).toContain('TAG_BLOCK_MISMATCH');
  });

  it('TAG_BLOCK_NOT_ALONE when a block tag shares a paragraph', () => {
    expect(codes(parseTemplate(body('texto {{#se onus}}', '{{/se}}')))).toContain('TAG_BLOCK_NOT_ALONE');
  });

  it('allows a block tag alone in its paragraph', () => {
    expect(codes(parseTemplate(body('{{#se onus}}', 'texto', '{{/se}}')))).toEqual([]);
  });

  it('TAG_MODIFIER_INVALID on an unknown modifier', () => {
    expect(codes(parseTemplate(body('{{x|shout}}')))).toContain('TAG_MODIFIER_INVALID');
  });

  it('TAG_MODIFIER_INVALID when extenso is used on a non-numeric type', () => {
    expect(codes(parseTemplate(body('{{x:nif|extenso}}')))).toContain('TAG_MODIFIER_INVALID');
    expect(codes(parseTemplate(body('{{x|extenso}}')))).toContain('TAG_MODIFIER_INVALID');
  });

  it('allows extenso on eur/int', () => {
    expect(codes(parseTemplate(body('{{x:eur|extenso}}')))).toEqual([]);
    expect(codes(parseTemplate(body('{{y:int|extenso}}')))).toEqual([]);
  });

  it('REF_UNKNOWN when a ref target has no anchor', () => {
    expect(codes(parseTemplate(body('{{ref:nope}}')))).toContain('REF_UNKNOWN');
  });

  it('resolves refs declared later in the document', () => {
    expect(codes(parseTemplate(body('{{ref:cl1}}', 'CLÁUSULA {{cl cl1}}')))).not.toContain('REF_UNKNOWN');
  });

  it('ANCHOR_DUPLICATE when the same anchor id is declared twice', () => {
    expect(codes(parseTemplate(body('{{cl a}}', '{{cl a}}')))).toContain('ANCHOR_DUPLICATE');
  });

  it('TAG_UNSUPPORTED_LOCATION for tags in headers/footers', () => {
    const result = parseTemplate([{ location: 'header', text: '{{x}}' }]);
    expect(codes(result)).toContain('TAG_UNSUPPORTED_LOCATION');
  });
});

describe('parseTemplate — escaping', () => {
  it('treats \\{{ as a literal "{{"', () => {
    const result = parseTemplate(body('Escreva \\{{ assim }}.'));
    expect(result.errors).toEqual([]);
    expect(result.paragraphs[0]?.nodes).toEqual([{ kind: 'text', text: 'Escreva {{ assim }}.' }]);
  });
});

describe('parse(render(x)) round-trips', () => {
  it('for a representative multi-block document', () => {
    const source = body(
      'CONTRATO {{titulo|upper}}',
      'Olá \\{{ literal }}, {{nome}}.',
      '{{#se onus}}',
      '{{pt}}. Valor: {{preco:eur|extenso}}.',
      '{{/se}}',
      'Ref: {{ref:cl1}}. CLÁUSULA {{cl cl1}}',
    );
    const first = parseTemplate(source);
    const rerendered = renderParagraphs(first.paragraphs);
    const second = parseTemplate(rerendered);
    expect(second.paragraphs).toEqual(first.paragraphs);
    expect(second.errors).toEqual(first.errors);
  });
});
