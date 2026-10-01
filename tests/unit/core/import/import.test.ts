import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readDocx } from '../../../../src/core/docx/read';
import { detectBlanks } from '../../../../src/core/import/detect';
import { generateTemplate } from '../../../../src/core/import/generate';
import { inferFields } from '../../../../src/core/import/infer';
import { findSensitive, looksFilled } from '../../../../src/core/import/safeguard';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function makeDocx(paragraphs: string[][]): Uint8Array {
  const body = paragraphs
    .map((runs) => `<w:p>${runs.map((t) => `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${t}</w:t></w:r>`).join('')}</w:p>`)
    .join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`;
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    'word/document.xml': strToU8(documentXml),
  });
}

const EXAMPLE =
  '[Nome do Vendedor], [Estado civil do vendedor], natural da freguesia de [inserir freguesia], concelho de [inserir concelho], ' +
  'NIF [Contribuinte do vendedor], titular do cartão de cidadão nº [inserir todos os dígitos do CC, incluindo os de confirmação], ' +
  'emitido pelas entidades competentes da República Portuguesa, válido até __/__/_____, residente em [Morada do vendedor], ' +
  'adiante designado por Primeiro Outorgante ou Promitente Vendedor.';

describe('detectBlanks', () => {
  it('finds brackets and the date blank in the example clause', () => {
    const { blanks } = detectBlanks([EXAMPLE]);
    expect(blanks.map((b) => b.raw)).toEqual([
      '[Nome do Vendedor]',
      '[Estado civil do vendedor]',
      '[inserir freguesia]',
      '[inserir concelho]',
      '[Contribuinte do vendedor]',
      '[inserir todos os dígitos do CC, incluindo os de confirmação]',
      '__/__/_____',
      '[Morada do vendedor]',
    ]);
    expect(blanks[6]?.kind).toBe('date');
    expect(blanks[0]?.label).toBe('Nome do Vendedor');
  });

  it('skips choice instructions and empty brackets', () => {
    const r = detectBlanks(['[escolher uma: a) x b) y] e [] e ....']);
    expect(r.skippedChoices).toBe(1);
    expect(r.blanks.map((b) => b.raw)).toEqual(['....']);
  });
});

describe('inferFields', () => {
  it('infers types, roles and ids for the example clause', () => {
    const { fields, blanks } = inferFields(detectBlanks([EXAMPLE]).blanks);
    const byId = Object.fromEntries(fields.map((f) => [f.id, f]));
    expect(byId.vendedor_nome?.type).toBe('text');
    expect(byId.vendedor_estado_civil?.options?.length).toBeGreaterThan(3);
    expect(byId.vendedor_freguesia).toBeDefined();
    expect(byId.vendedor_concelho).toBeDefined();
    expect(byId.vendedor_nif?.type).toBe('nif');
    expect(byId.vendedor_cc?.type).toBe('cc');
    expect(byId.vendedor_validade?.type).toBe('data');
    expect(byId.vendedor_morada?.type).toBe('text');
    expect(blanks).toHaveLength(8);
  });

  it('reuses one field for repeated labels and joins "por extenso" to the amount', () => {
    const { fields, blanks } = inferFields(
      detectBlanks(['[Nome do Comprador] e [Nome do Comprador]. Preço de [preço] euros ([preço por extenso]).']).blanks,
    );
    expect(fields.filter((f) => f.id === 'comprador_nome')).toHaveLength(1);
    const price = fields.find((f) => f.type === 'eur');
    expect(price).toBeDefined();
    expect(blanks.at(-1)?.modifier).toBe('extenso');
    expect(blanks.at(-1)?.fieldKey).toBe(price?.key);
  });
});

describe('generateTemplate', () => {
  it('rewrites blanks split across runs into tags and passes the template lint', () => {
    const bytes = makeDocx([['Nome: [Nome do ', 'Vendedor]. NIF [Contribuinte do vendedor].'], [EXAMPLE]]);
    const doc = readDocx(bytes);
    const { blanks } = detectBlanks(doc.paragraphs.map((p) => p.text));
    const inferred = inferFields(blanks);
    const result = generateTemplate({ bytes, ...inferred, title: 'Teste', templateId: 'teste' });

    expect(result.problems).toEqual([]);
    const out = readDocx(result.docxBytes as Uint8Array);
    expect(out.paragraphs[0]?.text).toBe('Nome: {{vendedor_nome}}. NIF {{vendedor_nif:nif}}.');
    expect(out.paragraphs[1]?.text).toContain('válido até {{vendedor_validade:data}}, residente em {{vendedor_morada}}');
    expect(result.meta?.fields.vendedor_estado_civil?.options).toBeDefined();
    expect(result.meta?.groups?.[0]?.label).toBe('Promitente-Vendedor');
  });

  it('rejects duplicate ids edited in the review step', () => {
    const bytes = makeDocx([['[Nome do Vendedor] [Nome do Comprador]']]);
    const { blanks } = detectBlanks(readDocx(bytes).paragraphs.map((p) => p.text));
    const inferred = inferFields(blanks);
    const fields = inferred.fields.map((f) => ({ ...f, id: 'mesmo' }));
    const result = generateTemplate({ bytes, blanks: inferred.blanks, fields, title: 'T', templateId: 't' });
    expect(result.docxBytes).toBeNull();
    expect(result.problems[0]?.code).toBe('FIELD_ID_DUPLICATE');
  });

  it('leaves excluded fields as literal text', () => {
    const bytes = makeDocx([['[Nome do Vendedor] e NIF [Contribuinte do vendedor]']]);
    const { blanks } = detectBlanks(readDocx(bytes).paragraphs.map((p) => p.text));
    const inferred = inferFields(blanks);
    const result = generateTemplate({ bytes, ...inferred, excluded: new Set(['vendedor_nif']), title: 'T', templateId: 't' });
    expect(readDocx(result.docxBytes as Uint8Array).paragraphs[0]?.text).toBe('{{vendedor_nome}} e NIF [Contribuinte do vendedor]');
  });
});

describe('findSensitive', () => {
  it('flags checksum-valid NIF/IBAN and emails, not blanks', () => {
    expect(looksFilled(findSensitive(EXAMPLE))).toBe(false);
    const f = findSensitive('NIF 252601815, IBAN PT50 9999 4628 1948 2199 3512 3, a@b.pt');
    expect(f).toEqual({ nif: 1, iban: 1, email: 1 });
    expect(findSensitive('IBAN PT50999946281948219935123').iban).toBe(1);
  });
});

describe('security hardening', () => {
  it('rejects reserved ids in tags and in the importer', async () => {
    const { classifyTag } = await import('../../../../src/core/tags/classify');
    expect(classifyTag('constructor').node.kind).toBe('invalid');
    expect(classifyTag('#constructor').node.kind).toBe('invalid');
    expect(classifyTag('vendedor_nome').node.kind).toBe('value');
  });

  it('drops unsafe external relationships but keeps https hyperlinks', async () => {
    const { sanitizeArchive } = await import('../../../../src/core/docx/sanitize');
    const rels = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="a" Type="x/hyperlink" Target="https://ok.pt" TargetMode="External"/>
      <Relationship Id="b" Type="x/hyperlink" Target="javascript:alert(1)" TargetMode="External"/>
      <Relationship Id="c" Type="x/attachedTemplate" Target="file:///C:/evil/t.dotm" TargetMode="External"/>
      <Relationship Id="d" Type="x/styles" Target="styles.xml"/></Relationships>`;
    const archive = new Map([['word/_rels/document.xml.rels', strToU8(rels)]]);
    sanitizeArchive(archive);
    const out = new TextDecoder().decode(archive.get('word/_rels/document.xml.rels'));
    expect(out).toContain('https://ok.pt');
    expect(out).toContain('styles.xml');
    expect(out).not.toContain('javascript');
    expect(out).not.toContain('evil');
  });

  it('refuses style names that could inject CSS, and path-traversal / macro entries', async () => {
    const { sanitizeArchive } = await import('../../../../src/core/docx/sanitize');
    const styles = `<w:styles xmlns:w="${W}"><w:style w:styleId="a{}*{display:none}"/></w:styles>`;
    expect(() => sanitizeArchive(new Map([['word/styles.xml', strToU8(styles)]]))).toThrow(/style name/);
    const { readDocxArchive } = await import('../../../../src/core/docx/zip');
    const evil = zipSync({ '../evil.txt': strToU8('x'), 'word/document.xml': strToU8('<a/>') });
    expect(() => readDocxArchive(evil)).toThrow(/not allowed/);
    const macro = zipSync({ 'word/vbaProject.bin': strToU8('x'), 'word/document.xml': strToU8('<a/>') });
    expect(() => readDocxArchive(macro)).toThrow(/not allowed/);
  });
});
