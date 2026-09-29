// T1.4: synthetic fixture .docx files for tag-engine tests, incl. tags split
// across 1/2/3 runs and a table-cell tag. Hand-built minimal OOXML (no Word
// dependency) so fixtures/ regenerates deterministically. Run: tsx scripts/generate-fixtures.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { zipSync } from 'fflate';

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
`;

const PACKAGE_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
`;

function documentXml(bodyXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
${bodyXml}
  </w:body>
</w:document>
`;
}

function buildDocx(bodyXml: string): Uint8Array {
  const enc = new TextEncoder();
  return zipSync(
    {
      '[Content_Types].xml': enc.encode(CONTENT_TYPES),
      '_rels/.rels': enc.encode(PACKAGE_RELS),
      'word/document.xml': enc.encode(documentXml(bodyXml)),
    },
    { level: 6 },
  );
}

const SPLIT_RUNS_BODY = `
    <w:p><w:r><w:t xml:space="preserve">Um run: {{nome}}.</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Dois runs: {{no</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">me}}.</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Três runs: {{pr</w:t></w:r><w:r><w:t>eco:e</w:t></w:r><w:r><w:t xml:space="preserve">ur}}.</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Escape: \\{{ nao-tag }}.</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t xml:space="preserve">Célula: {{nome}}.</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
`;

const out = join(process.cwd(), 'fixtures');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'split-runs.docx'), buildDocx(SPLIT_RUNS_BODY));
console.log('wrote fixtures/split-runs.docx');
