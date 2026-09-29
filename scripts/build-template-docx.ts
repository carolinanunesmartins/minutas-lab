// T5.1/docs/templates.md: build a plainly-styled template.docx from a
// source.txt draft (title/clause/point formatting), no Word/python needed.
// Usage: tsx scripts/build-template-docx.ts <source.txt> <out_dir> [--title "..."]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { zipSync } from 'fflate';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const RE_CLAUSE = /^CL[AÁ]USULA\s+(\{\{\s*cl\b[^}]*\}\}|[A-ZÁÂÉÊÍÓÔÚÇ ]+)\s*$/;
const RE_CLAUSE_TITLE = /^\(.+\)$/;
const RE_POINT = /^(\{\{\s*pt\b[^}]*\}\}\.)\s+(.*)$/;
const RE_SIGN = /^-{3,}$/;
const RE_BOLD_SPLIT = /(\*\*.+?\*\*)/;

function xmlEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function run(text: string, opts: { bold?: boolean } = {}): string {
  const rPr = opts.bold ? '<w:rPr><w:b/></w:rPr>' : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

/** Split on **bold** spans, emitting a run per span. */
function inlineRuns(text: string, opts: { boldAll?: boolean } = {}): string {
  return text
    .split(RE_BOLD_SPLIT)
    .filter((part) => part.length > 0)
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return run(part.slice(2, -2), { bold: true });
      }
      return run(part, { bold: opts.boldAll ?? false });
    })
    .join('');
}

function paragraph(innerXml: string, opts: { align?: 'center' | 'left' | 'both'; bold?: boolean; sizeHalfPt?: number } = {}): string {
  const jc = opts.align ? `<w:jc w:val="${opts.align}"/>` : '';
  const rPr = opts.bold || opts.sizeHalfPt ? `<w:rPr>${opts.bold ? '<w:b/>' : ''}${opts.sizeHalfPt ? `<w:sz w:val="${opts.sizeHalfPt}"/>` : ''}</w:rPr>` : '';
  const pPr = jc || rPr ? `<w:pPr>${jc}${rPr}</w:pPr>` : '';
  return `<w:p>${pPr}${innerXml}</w:p>`;
}

interface ParsedSource {
  body: string[];
  fields: string[][];
}

function parseSource(text: string): ParsedSource {
  const [bodyPart] = text.split('=== CAMPOS ===');
  const body = (bodyPart ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const fieldsMatch = /=== CAMPOS ===\r?\n([\s\S]*?)(?:\r?\n=== |\r?\n?$)/.exec(text);
  const fields = (fieldsMatch?.[1] ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.includes('|'))
    .map((l) => l.split('|').map((c) => c.trim()));

  return { body, fields };
}

function buildBodyXml(lines: string[]): string {
  const out: string[] = [];
  lines.forEach((line, i) => {
    if (i === 0) {
      out.push(paragraph(inlineRuns(line, { boldAll: true }), { align: 'center', bold: true, sizeHalfPt: 32 }));
      return;
    }
    if (RE_CLAUSE.test(line)) {
      out.push(paragraph(inlineRuns(line, { boldAll: true }), { align: 'center', bold: true }));
      return;
    }
    if (RE_CLAUSE_TITLE.test(line) && i > 0 && RE_CLAUSE.test(lines[i - 1])) {
      out.push(paragraph(inlineRuns(line, { boldAll: true }), { align: 'center', bold: true }));
      return;
    }
    if (RE_SIGN.test(line)) {
      out.push(paragraph(run('_'.repeat(44))));
      return;
    }
    if (line.toUpperCase() === 'ENTRE:') {
      out.push(paragraph(inlineRuns(line, { boldAll: true })));
      return;
    }
    const pointMatch = RE_POINT.exec(line);
    if (pointMatch) {
      const xml = run(`${pointMatch[1]} `, { bold: true }) + inlineRuns(pointMatch[2]);
      out.push(paragraph(xml, { align: 'both' }));
      return;
    }
    out.push(paragraph(inlineRuns(line), { align: 'both' }));
  });
  return out.join('\n');
}

function documentXml(bodyXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}">
  <w:body>
${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1440" w:bottom="1440" w:left="1440" w:header="709" w:footer="709"/>
    </w:sectPr>
  </w:body>
</w:document>
`;
}

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

function buildDocxBytes(bodyLines: string[]): Uint8Array {
  const enc = new TextEncoder();
  return zipSync(
    {
      '[Content_Types].xml': enc.encode(CONTENT_TYPES),
      '_rels/.rels': enc.encode(PACKAGE_RELS),
      'word/document.xml': enc.encode(documentXml(buildBodyXml(bodyLines))),
    },
    { level: 6 },
  );
}

function metaSkeleton(id: string, title: string, fields: string[][]): object {
  const fieldEntries: Record<string, { required?: boolean; label?: string }> = {};
  for (const row of fields) {
    const [fid, , required, label] = row;
    if (!fid || fid.toLowerCase() === 'id') continue;
    const entry: { required?: boolean; label?: string } = {};
    const req = (required ?? '').toLowerCase();
    if (['sim', 's', 'yes', 'y', 'true', 'obrigatório', 'obrigatorio'].includes(req)) entry.required = true;
    if (label) entry.label = label;
    fieldEntries[fid] = entry;
  }
  return { id, title, version: '0.1.0', fields: fieldEntries };
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: build-template-docx.ts <source.txt> <out_dir> [--title "..."]');
    process.exit(1);
  }
  const [sourcePath, outDir] = args;
  const titleIdx = args.indexOf('--title');
  const titleOverride = titleIdx !== -1 ? args[titleIdx + 1] : undefined;

  const text = readFileSync(sourcePath, 'utf-8');
  const { body, fields } = parseSource(text);
  if (body.length === 0) throw new Error('source.txt has no body content before === CAMPOS ===');

  mkdirSync(outDir, { recursive: true });
  const bytes = buildDocxBytes(body);
  writeFileSync(join(outDir, 'template.docx'), bytes);

  const id = basename(outDir);
  const meta = metaSkeleton(id, titleOverride ?? (body[0]), fields);
  writeFileSync(join(outDir, 'template.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);

  console.log(`ok ${outDir}`);
}

main();
