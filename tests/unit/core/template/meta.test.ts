import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadTemplateMeta } from '../../../../src/core/template/meta';
import { collectUsedFieldIds } from '../../../../src/core/template/fields';
import { parseTemplate } from '../../../../src/core/tags/parse';
import type { RawParagraph } from '../../../../src/core/tags/types';

describe('loadTemplateMeta — shape validation', () => {
  it('accepts a minimal valid meta', () => {
    const { meta, errors } = loadTemplateMeta({ id: 'x', title: 'X', version: '0.1.0', fields: {} }, new Set());
    expect(errors).toEqual([]);
    expect(meta).toEqual({ id: 'x', title: 'X', version: '0.1.0', fields: {} });
  });

  it('rejects missing required top-level keys', () => {
    const { meta, errors } = loadTemplateMeta({ id: 'x' }, new Set());
    expect(meta).toBeNull();
    expect(errors[0]?.code).toBe('META_INVALID_SHAPE');
  });

  it('rejects a malformed field entry', () => {
    const { meta, errors } = loadTemplateMeta({ id: 'x', title: 'X', version: '1', fields: { a: { required: 'yes' } } }, new Set());
    expect(meta).toBeNull();
    expect(errors[0]?.code).toBe('META_INVALID_SHAPE');
  });

  it('flags META_UNKNOWN_FIELD for a meta field never used in the template body', () => {
    const { errors } = loadTemplateMeta(
      { id: 'x', title: 'X', version: '1', fields: { used: {}, ghost: {} } },
      new Set(['used']),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe('META_UNKNOWN_FIELD');
    expect(errors[0]?.field).toBe('ghost');
    expect(errors[0]?.message).toContain('ghost');
  });

  it('accepts a well-formed rules array', () => {
    const { meta, errors } = loadTemplateMeta(
      {
        id: 'x',
        title: 'X',
        version: '1',
        fields: { a: {}, b: {}, total: {} },
        rules: [
          { type: 'sum_eq', fields: ['a', 'b'], total: 'total', severity: 'error' },
          { type: 'date_after', field: 'a', than: 'today', severity: 'error' },
          { type: 'differs', a: 'a', b: 'b', severity: 'warning' },
          { type: 'required_if', field: 'a', when: { field: 'b', nonEmpty: true } },
        ],
      },
      new Set(['a', 'b', 'total']),
    );
    expect(errors).toEqual([]);
    expect(meta?.rules).toHaveLength(4);
  });
});

function bodyParagraphs(source: string): RawParagraph[] {
  return source
    .split('=== CAMPOS ===')[0]!
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((text) => ({ location: 'body' as const, text }));
}

describe('loadTemplateMeta — real CPCV template', () => {
  it('has zero META_UNKNOWN_FIELD against the actual template body', () => {
    const source = readFileSync(join(__dirname, '../../../../templates/cpcv/source.txt'), 'utf-8');
    const metaRaw: unknown = JSON.parse(readFileSync(join(__dirname, '../../../../templates/cpcv/template.meta.json'), 'utf-8'));
    const { paragraphs } = parseTemplate(bodyParagraphs(source));
    const used = collectUsedFieldIds(paragraphs);
    const { meta, errors } = loadTemplateMeta(metaRaw, used);
    expect(meta).not.toBeNull();
    expect(errors).toEqual([]);
  });
});
