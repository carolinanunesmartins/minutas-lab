import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readDocx } from '../../../../src/core/docx/read';
import { findParagraphs } from '../../../../src/core/docx/runmap';
import { substituteValueTags } from '../../../../src/core/docx/replace';
import { W_NS } from '../../../../src/core/docx/ooxml';

const FIXTURE = join(__dirname, '../../../../fixtures/split-runs.docx');

function reReadBodyParagraphs(documentXmlDoc: Document) {
  const body = documentXmlDoc.getElementsByTagNameNS(W_NS, 'body')[0];
  if (!body) throw new Error('no body');
  return findParagraphs(body, 'body');
}

describe('substituteValueTags — split-run fixture', () => {
  const values = { nome: 'Maria', preco: '123' };

  it('replaces a tag split across 1/2/3 runs and a table-cell tag', () => {
    const bytes = readFileSync(FIXTURE);
    const doc = readDocx(bytes);

    for (const p of doc.paragraphs) {
      substituteValueTags(p, values);
    }

    const after = reReadBodyParagraphs(doc.documentXmlDoc);
    const texts = after.map((p) => p.text);

    expect(texts).toContain('Um run: Maria.');
    expect(texts).toContain('Dois runs: Maria.');
    expect(texts).toContain('Três runs: 123.');
    expect(texts).toContain('Escape: {{ nao-tag }}.');
    expect(texts).toContain('Célula: Maria.');
  });

  it('preserves the first overlapping run\'s formatting for a split tag', () => {
    const bytes = readFileSync(FIXTURE);
    const doc = readDocx(bytes);

    const twoRunParagraph = doc.paragraphs.find((p) => p.text.startsWith('Dois runs:'));
    expect(twoRunParagraph).toBeDefined();
    // Original: run 1 "Dois runs: {{no" has no rPr, run 2 "me}}." has <w:b/>.
    expect(twoRunParagraph?.runs[0]?.rPr).toBeNull();
    expect(twoRunParagraph?.runs[1]?.rPr).not.toBeNull();

    substituteValueTags(twoRunParagraph!, values);

    const after = reReadBodyParagraphs(doc.documentXmlDoc).find((p) => p.text === 'Dois runs: Maria.');
    expect(after).toBeDefined();
    // The replacement value itself must take the *first* overlapping run's (bold-less) formatting,
    // even though the trailing "." (outside the replaced span) keeps the second run's bold rPr.
    const replacementRun = after?.runs.find((r) => r.text === 'Maria');
    expect(replacementRun?.rPr).toBeNull();
    const trailingRun = after?.runs.find((r) => r.text === '.');
    expect(trailingRun?.rPr).not.toBeNull();
  });

  it('missing values become empty strings', () => {
    const bytes = readFileSync(FIXTURE);
    const doc = readDocx(bytes);
    const p = doc.paragraphs.find((par) => par.text.startsWith('Um run:'));
    substituteValueTags(p!, {});
    const after = reReadBodyParagraphs(doc.documentXmlDoc);
    expect(after.map((par) => par.text)).toContain('Um run: .');
  });
});
