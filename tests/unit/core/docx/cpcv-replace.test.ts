import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readDocx } from '../../../../src/core/docx/read';
import { findParagraphs } from '../../../../src/core/docx/runmap';
import { substituteValueTags } from '../../../../src/core/docx/replace';
import { W_NS } from '../../../../src/core/docx/ooxml';
import { findTagSpans } from '../../../../src/core/tags/tokenize';
import { classifyTag } from '../../../../src/core/tags/classify';

const CPCV_DOCX = join(__dirname, '../../../../templates/cpcv/template.docx');

describe('substituteValueTags — real CPCV template', () => {
  it('replaces every value tag across the whole document without throwing', () => {
    const bytes = readFileSync(CPCV_DOCX);
    const doc = readDocx(bytes);

    const values: Record<string, string> = { vendedor_nome: 'Maria Exemplo Silva', preco_total: '235000,00' };

    for (const p of doc.paragraphs) {
      substituteValueTags(p, values);
    }

    const body = doc.documentXmlDoc.getElementsByTagNameNS(W_NS, 'body')[0];
    const after = findParagraphs(body!, 'body');

    const remainingValueTags = after.flatMap((p) =>
      findTagSpans(p.text)
        .map((s) => classifyTag(s.raw).node)
        .filter((n) => n.kind === 'value'),
    );
    expect(remainingValueTags).toEqual([]);

    const fullText = after.map((p) => p.text).join('\n');
    expect(fullText).toContain('Maria Exemplo Silva');
    expect(fullText).toContain('235000,00');
    // Block/numbering/ref tags are intentionally left for M3.
    expect(fullText).toMatch(/\{\{cl(\s+\w+)?\}\}/);
  });
});
