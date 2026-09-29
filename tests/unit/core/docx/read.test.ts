import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readDocx, toRawParagraphs } from '../../../../src/core/docx/read';
import { DocxInputError } from '../../../../src/core/docx/zip';
import { parseTemplate } from '../../../../src/core/tags/parse';

const CPCV_DOCX = join(__dirname, '../../../../templates/cpcv/template.docx');

describe('readDocx — CPCV fixture', () => {
  it('reads body paragraphs with run-maps whose text matches the paragraph text', () => {
    const bytes = readFileSync(CPCV_DOCX);
    const doc = readDocx(bytes);

    expect(doc.paragraphs.length).toBeGreaterThan(50);
    for (const p of doc.paragraphs) {
      expect(p.runs.map((r) => r.text).join('')).toBe(p.text);
      for (const r of p.runs) {
        expect(p.text.slice(r.start, r.end)).toBe(r.text);
      }
    }
  });

  it('produces paragraph text that the tag parser accepts with zero errors', () => {
    const bytes = readFileSync(CPCV_DOCX);
    const doc = readDocx(bytes);
    const result = parseTemplate(toRawParagraphs(doc));
    expect(result.errors).toEqual([]);
  });
});

describe('readDocx — bounded input', () => {
  it('rejects a file over the size limit', () => {
    const big = new Uint8Array(6 * 1024 * 1024);
    expect(() => readDocx(big)).toThrow(DocxInputError);
  });

  it('rejects non-zip bytes', () => {
    expect(() => readDocx(new Uint8Array([1, 2, 3, 4]))).toThrow(DocxInputError);
  });
});
