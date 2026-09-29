import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTemplate } from '../../../../src/core/tags/parse';
import type { RawParagraph } from '../../../../src/core/tags/types';

// Sanity check the real M5-track CPCV draft against the M1 parser: it must be
// tag-grammar-clean (the authoring lint.py already checks this independently).
function loadCpcvBodyParagraphs(): RawParagraph[] {
  const source = readFileSync(join(__dirname, '../../../../templates/cpcv/source.txt'), 'utf-8');
  const body = source.split('=== CAMPOS ===')[0] ?? '';
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((text) => ({ location: 'body' as const, text }));
}

describe('CPCV template draft (templates/cpcv/source.txt)', () => {
  it('is free of tag-grammar errors', () => {
    const result = parseTemplate(loadCpcvBodyParagraphs());
    expect(result.errors).toEqual([]);
  });
});
