import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTemplate } from '../../../../src/core/tags/parse';
import { collectFieldTypes, collectUsedFieldIds } from '../../../../src/core/template/fields';
import { loadTemplateMeta } from '../../../../src/core/template/meta';
import { validateTemplateValues } from '../../../../src/core/template/validate';
import type { RawParagraph } from '../../../../src/core/tags/types';

describe('validateTemplateValues — layers', () => {
  const doc: RawParagraph[] = [
    { location: 'body', text: 'NIF: {{nif_campo:nif}}' },
    { location: 'body', text: 'Preço: {{preco:eur}}' },
    { location: 'body', text: 'Sinal: {{sinal:eur}}' },
    { location: 'body', text: 'Remanescente: {{rem:eur}}' },
  ];
  const rawMeta = {
    id: 't',
    title: 'T',
    version: '1',
    fields: { nif_campo: { required: true }, preco: {}, sinal: {}, rem: {} },
    rules: [{ type: 'sum_eq', fields: ['sinal', 'rem'], total: 'preco', severity: 'error' }],
  };

  function run(values: Record<string, string>) {
    const { paragraphs, errors } = parseTemplate(doc);
    const fieldTypes = collectFieldTypes(paragraphs);
    const used = collectUsedFieldIds(paragraphs);
    const { meta } = loadTemplateMeta(rawMeta, used);
    return validateTemplateValues({
      paragraphs,
      meta: meta!,
      fieldTypes,
      values,
      todayIso: '2026-09-29',
      tagErrors: errors,
    });
  }

  it('layer 1: flags an invalid NIF format/checksum as error', () => {
    const result = run({ nif_campo: '296030822', preco: '', sinal: '', rem: '' });
    expect(result.fieldIssues).toContainEqual({ field: 'nif_campo', code: 'FORMAT_INVALID', severity: 'error' });
    expect(result.hasBlockingError).toBe(true);
  });

  it('layer 1: accepts a valid NIF', () => {
    const result = run({ nif_campo: '252601815', preco: '', sinal: '', rem: '' });
    expect(result.fieldIssues.filter((i) => i.code === 'FORMAT_INVALID')).toEqual([]);
  });

  it('layer 2: flags a missing required field', () => {
    const result = run({ nif_campo: '', preco: '', sinal: '', rem: '' });
    expect(result.fieldIssues).toContainEqual({ field: 'nif_campo', code: 'REQUIRED', severity: 'error' });
  });

  it('layer 3: flags a violated sum_eq rule at its configured severity', () => {
    const result = run({ nif_campo: '252601815', preco: '1.000,00', sinal: '100,00', rem: '800,00' });
    expect(result.ruleIssues).toContainEqual({ ruleType: 'sum_eq', severity: 'error', fields: ['sinal', 'rem', 'preco'] });
  });

  it('all green: no issues, not blocking', () => {
    const result = run({ nif_campo: '252601815', preco: '1.000,00', sinal: '100,00', rem: '900,00' });
    expect(result.fieldIssues).toEqual([]);
    expect(result.ruleIssues).toEqual([]);
    expect(result.structuralErrors).toEqual([]);
    expect(result.hasBlockingError).toBe(false);
  });
});

describe('validateTemplateValues — layer 4 (structural)', () => {
  it('a dangling ref is a blocking structural error', () => {
    const doc: RawParagraph[] = [{ location: 'body', text: 'Ref: {{ref:nowhere}}' }];
    const { paragraphs, errors } = parseTemplate(doc);
    const meta = loadTemplateMeta({ id: 't', title: 'T', version: '1', fields: {} }, new Set()).meta!;
    const result = validateTemplateValues({
      paragraphs,
      meta,
      fieldTypes: new Map(),
      values: {},
      todayIso: '2026-09-29',
      tagErrors: errors,
    });
    expect(result.structuralErrors.some((e) => e.code === 'REF_UNKNOWN')).toBe(true);
    expect(result.hasBlockingError).toBe(true);
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

describe('validateTemplateValues — real CPCV template', () => {
  it('produces zero structural errors and passes with the demo values', () => {
    const source = readFileSync(join(__dirname, '../../../../templates/cpcv/source.txt'), 'utf-8');
    const metaRaw: unknown = JSON.parse(readFileSync(join(__dirname, '../../../../templates/cpcv/template.meta.json'), 'utf-8'));
    const { paragraphs, errors } = parseTemplate(bodyParagraphs(source));
    const fieldTypes = collectFieldTypes(paragraphs);
    const used = collectUsedFieldIds(paragraphs);
    const { meta } = loadTemplateMeta(metaRaw, used);
    expect(meta).not.toBeNull();

    // Mirrors scripts/render_demo.py's V dict (synthetic demo values), filled
    // in fully (that script only needed the fields it interpolates; the
    // validation engine needs every field meta.fields marks as required).
    const values: Record<string, string> = {
      vendedor_nome: 'Maria Exemplo Silva',
      vendedor_estado_civil: 'solteira, maior',
      vendedor_freguesia_naturalidade: 'Santa Maria dos Olivais',
      vendedor_concelho_naturalidade: 'Lisboa',
      vendedor_nif: '252601815',
      vendedor_cc: '123456789ZZ4',
      vendedor_cc_validade: '20/05/2031',
      vendedor_morada: 'Rua das Flores, n.º 10, 1.º Esq., 2300-000 Tomar',
      vendedor_email: 'vendedor@exemplo.invalid',
      vendedor_iban: 'PT50999946281948219935123',
      vendedor_banco: 'Banco Exemplo',
      comprador_nome: 'João Teste Costa',
      comprador_estado_civil: 'solteiro, maior',
      comprador_freguesia_naturalidade: 'São João Baptista',
      comprador_concelho_naturalidade: 'Tomar',
      comprador_nif: '259083011',
      comprador_cc: '111111111ZZ1',
      comprador_cc_validade: '02/11/2030',
      comprador_morada: 'Avenida do Rio, n.º 5, 2300-000 Tomar',
      comprador_email: 'comprador@exemplo.invalid',
      comprador_iban: 'PT50999981909378657975468',
      comprador_banco: 'Banco Modelo',
      imovel_fracao: 'B',
      imovel_composicao: 'três divisões, cozinha e casa de banho (T2)',
      imovel_morada: 'Rua do Exemplo, n.º 20, 2.º Dto.',
      imovel_freguesia: 'São João Baptista',
      imovel_concelho: 'Tomar',
      imovel_conservatoria: 'Tomar',
      imovel_descricao_registo: '1234/20000101-B',
      imovel_artigo_matricial: '5678-B',
      imovel_certificado_energetico: 'SCE000000000',
      imovel_certificado_validade: '01/03/2032',
      imovel_licenca_utilizacao: '00/2000',
      imovel_licenca_data: '15/06/2000',
      imovel_licenca_camara: 'Tomar',
      onus: 'sim',
      onus_descricao: 'hipoteca voluntária a favor de entidade bancária',
      onus_prorrogacao_dias: '30',
      arrendado: '',
      preco_total: '235.000,00',
      sinal_valor: '23.500,00',
      reforco: '',
      remanescente_valor: '211.500,00',
      financiamento: 'sim',
      financiamento_prazo: '15/12/2026',
      escritura_data_limite: '31/01/2027',
      aviso_dias: '8',
      incumprimento_prazo_dias: '10',
      documentos_prazo_dias: '2',
      condominio_prazo_dias: '20',
      domicilio_prazo_dias: '15',
      mediacao: 'sim',
      mediadora_nome: 'Imobiliária Exemplo, Lda.',
      mediadora_nipc: '566131862',
      mediadora_licenca_ami: '00000',
      reconhecimento_presencial: 'sim',
      reconhecimento_entidade: 'advogado com inscrição em vigor',
      foro_comarca: 'Santarém',
      contrato_local: 'Tomar',
      contrato_data: '15/10/2026',
    };

    const result = validateTemplateValues({
      paragraphs,
      meta: meta!,
      fieldTypes,
      values,
      todayIso: '2026-09-29',
      tagErrors: errors,
    });

    expect(result.structuralErrors).toEqual([]);
    expect(result.fieldIssues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.ruleIssues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.hasBlockingError).toBe(false);
  });
});
