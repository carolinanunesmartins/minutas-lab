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

// M8: a minuta with blanks (brackets split across runs, a date blank, a table cell) for the importer.
const BLANK_MINUTA_BODY = `
    <w:p><w:r><w:t xml:space="preserve">Entre [Nome do Vendedor], NIF [Contribuinte do vendedor], válido até __/__/_____,</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">e [Nome do Com</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">prador], residente em [Morada do comprador].</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t xml:space="preserve">Preço: [preço] euros ([preço por extenso]).</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
`;


const P = (text: string, opts: { bold?: boolean; center?: boolean } = {}): string =>
  `    <w:p>${opts.center ? '<w:pPr><w:jc w:val="center"/></w:pPr>' : ''}<w:r>${opts.bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

// A short service contract whose blanks repeat on purpose: one input fills several places.
const SAMPLE_MINUTA_BODY = [
  P('CONTRATO DE PRESTAÇÃO DE SERVIÇOS', { bold: true, center: true }),
  P('Entre [Nome do Prestador], NIF [NIF do prestador], com sede em [Morada do prestador], adiante designado por Prestador, e [Nome do Cliente], NIF [NIF do cliente], residente em [Morada do cliente], adiante designado por Cliente, é celebrado o presente contrato.'),
  P('Cláusula 1.ª (Objeto). O Prestador, [Nome do Prestador], obriga-se a prestar ao Cliente, [Nome do Cliente], os seguintes serviços: [Descrição dos serviços].'),
  P('Cláusula 2.ª (Preço). O Cliente, [Nome do Cliente], pagará ao Prestador o valor de [Valor total] euros ([Valor total por extenso]).'),
  P('Cláusula 3.ª (Prazo). Os serviços iniciam-se em [Data de início] e terminam em [Data de fim], salvo prorrogação acordada por escrito entre [Nome do Prestador] e [Nome do Cliente].'),
  P('Cláusula 4.ª (Pagamento). O valor de [Valor total] euros é pago por transferência bancária para o IBAN [IBAN do prestador], titulado por [Nome do Prestador].'),
  P('Cláusula 5.ª (Comunicações). As comunicações ao Prestador são feitas para [Morada do prestador] e as comunicações ao Cliente para [Morada do cliente].'),
  P('[Local], __/__/____'),
  P('____________________'),
  P('[Nome do Prestador]'),
  P('____________________'),
  P('[Nome do Cliente]'),
].join('\n');

const out = join(process.cwd(), 'fixtures');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'split-runs.docx'), buildDocx(SPLIT_RUNS_BODY));
console.log('wrote fixtures/split-runs.docx');
writeFileSync(join(out, 'blank-minuta.docx'), buildDocx(BLANK_MINUTA_BODY));
console.log('wrote fixtures/blank-minuta.docx');
writeFileSync(join(out, 'sample-minuta-lacunas.docx'), buildDocx(SAMPLE_MINUTA_BODY));
console.log('wrote fixtures/sample-minuta-lacunas.docx');
