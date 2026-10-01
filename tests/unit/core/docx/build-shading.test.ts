import { describe, expect, it } from 'vitest';
import { buildDocx } from '../../../../src/core/docx/build';
import { readDocx } from '../../../../src/core/docx/read';
import { W_NS } from '../../../../src/core/docx/ooxml';
import { zipSync } from 'fflate';

function tinyDocx(bodyXml: string): Uint8Array {
  const enc = new TextEncoder();
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`;
  return zipSync(
    { '[Content_Types].xml': enc.encode(contentTypes), '_rels/.rels': enc.encode(rels), 'word/document.xml': enc.encode(doc) },
    { level: 6 },
  );
}

const BODY = '<w:p><w:r><w:t>Nome: {{nome}}. Preço: {{preco:eur}}.</w:t></w:r></w:p>';

function findRunShades(documentXmlDoc: Document): (string | null)[] {
  const runs = Array.from(documentXmlDoc.getElementsByTagNameNS(W_NS, 'r'));
  return runs.map((r) => {
    const shd = r.getElementsByTagNameNS(W_NS, 'shd')[0];
    return shd ? shd.getAttributeNS(W_NS, 'fill') : null;
  });
}

describe('buildDocx — shading (preview/draft only)', () => {
  it('applies no shading by default (final download)', () => {
    const doc = readDocx(tinyDocx(BODY));
    const bytes = buildDocx({ doc, values: { nome: 'Ana' }, disclaimerText: 'Disclaimer.' });
    const rebuilt = readDocx(bytes);
    expect(findRunShades(rebuilt.documentXmlDoc).some(Boolean)).toBe(false);
  });

  it('shades empty fields yellow and filled fields softly when shading is requested', () => {
    const doc = readDocx(tinyDocx(BODY));
    const bytes = buildDocx({ doc, values: { nome: 'Ana' }, disclaimerText: 'Disclaimer.', shading: {} });
    const rebuilt = readDocx(bytes);
    const text = rebuilt.paragraphs.map((p) => p.text).join('\n');
    expect(text).toContain('Nome: Ana.');
    expect(text).toContain('[preco]'); // empty field placeholder

    const shades = findRunShades(rebuilt.documentXmlDoc).filter(Boolean);
    expect(shades).toContain('FFF59D'); // empty
    expect(shades).toContain('F4F1E9'); // filled
  });

  it('highlights the active field more strongly', () => {
    const doc = readDocx(tinyDocx(BODY));
    const bytes = buildDocx({
      doc,
      values: { nome: 'Ana', preco: '10,00' },
      disclaimerText: 'Disclaimer.',
      shading: { activeFieldId: 'nome' },
    });
    const rebuilt = readDocx(bytes);
    const shades = findRunShades(rebuilt.documentXmlDoc).filter(Boolean);
    expect(shades).toContain('F2C879'); // active
    expect(shades).toContain('F4F1E9'); // filled (preco, not active)
  });

  it('wraps each value run in a fld_<id>_<n> bookmark only when anchors are requested', () => {
    const bookmarkNames = (bytes: Uint8Array): string[] =>
      Array.from(readDocx(bytes).documentXmlDoc.getElementsByTagNameNS(W_NS, 'bookmarkStart')).map((el) =>
        el.getAttributeNS(W_NS, 'name') ?? '',
      );
    const body = '<w:p><w:r><w:t>{{nome}} e {{nome}} e {{preco:eur}}</w:t></w:r></w:p>';
    const values = { nome: 'Ana' };

    const anchored = buildDocx({ doc: readDocx(tinyDocx(body)), values, disclaimerText: 'D.', shading: { anchors: true } });
    expect(bookmarkNames(anchored)).toEqual(['fld_nome_0', 'fld_nome_1', 'fld_preco_0']);
    const ends = readDocx(anchored).documentXmlDoc.getElementsByTagNameNS(W_NS, 'bookmarkEnd');
    expect(ends.length).toBe(3);

    const shadedOnly = buildDocx({ doc: readDocx(tinyDocx(body)), values, disclaimerText: 'D.', shading: {} });
    expect(bookmarkNames(shadedOnly)).toEqual([]);
    const final = buildDocx({ doc: readDocx(tinyDocx(body)), values, disclaimerText: 'D.' });
    expect(bookmarkNames(final)).toEqual([]);
  });

  it('anchors each conditional block on its first visible paragraph, or on what follows it when hidden', () => {
    const para = (t: string): string => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
    const body = para('Antes') + para('{{#extra}}') + para('Cláusula extra') + para('{{/extra}}') + para('Depois');
    const anchorParagraphs = (values: Record<string, string>): string[] => {
      const rebuilt = readDocx(buildDocx({ doc: readDocx(tinyDocx(body)), values, disclaimerText: 'D.', shading: { anchors: true } }));
      return rebuilt.paragraphs
        .filter((p) => p.element.getElementsByTagNameNS(W_NS, 'bookmarkStart').length > 0)
        .map((p) => `${p.text}@${p.element.getElementsByTagNameNS(W_NS, 'bookmarkStart')[0]?.getAttributeNS(W_NS, 'name')}`);
    };
    expect(anchorParagraphs({ extra: 'true' })).toEqual(['Cláusula extra@blk_extra']);
    expect(anchorParagraphs({})).toEqual(['Depois@blk_extra']);
  });

  it('appends a draft note in addition to the disclaimer', () => {
    const doc = readDocx(tinyDocx(BODY));
    const bytes = buildDocx({
      doc,
      values: { nome: 'Ana' },
      disclaimerText: 'Disclaimer.',
      draftNote: 'RASCUNHO — não descarregue como versão final.',
    });
    const text = readDocx(bytes).paragraphs.map((p) => p.text).join('\n');
    expect(text).toContain('Disclaimer.');
    expect(text).toContain('RASCUNHO');
  });
});
