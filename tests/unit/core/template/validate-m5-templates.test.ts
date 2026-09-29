import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readDocx } from '../../../../src/core/docx/read';
import { parseTemplate } from '../../../../src/core/tags/parse';
import { collectFieldTypes, collectUsedFieldIds } from '../../../../src/core/template/fields';
import { loadTemplateMeta } from '../../../../src/core/template/meta';
import { validateTemplateValues } from '../../../../src/core/template/validate';

function loadParsed(slug: string) {
  const doc = readDocx(readFileSync(join(__dirname, `../../../../templates/${slug}/template.docx`)));
  const rawBody = doc.paragraphs.map((p) => ({ location: 'body' as const, text: p.text }));
  const { paragraphs, errors } = parseTemplate(rawBody);
  const metaRaw: unknown = JSON.parse(readFileSync(join(__dirname, `../../../../templates/${slug}/template.meta.json`), 'utf-8'));
  const used = collectUsedFieldIds(paragraphs);
  const { meta, errors: metaErrors } = loadTemplateMeta(metaRaw, used);
  return { paragraphs, tagErrors: errors, meta, metaErrors, fieldTypes: collectFieldTypes(paragraphs) };
}

describe('template.meta.json — M5 templates load with zero META_UNKNOWN_FIELD', () => {
  it.each(['arrendamento', 'empreitada', 'procuracao'])('%s', (slug) => {
    const { meta, metaErrors } = loadParsed(slug);
    expect(meta).not.toBeNull();
    expect(metaErrors).toEqual([]);
  });
});

describe('validateTemplateValues — arrendamento passes with a complete valid demo set', () => {
  it('has zero blocking errors', () => {
    const { paragraphs, tagErrors, meta, fieldTypes } = loadParsed('arrendamento');
    const values: Record<string, string> = {
      senhorio_nome: 'Carlos Exemplo Neves',
      senhorio_estado_civil: 'casado, comunhão de adquiridos',
      senhorio_nif: '252601815',
      senhorio_morada: 'Rua do Senhorio, n.º 1, Lisboa',
      senhorio_iban: 'PT50999946281948219935123',
      senhorio_banco: 'Banco Exemplo',
      senhorio_email: 'senhorio@exemplo.invalid',
      arrendatario_nome: 'Beatriz Exemplo Santos',
      arrendatario_estado_civil: 'solteira, maior',
      arrendatario_nif: '259083011',
      arrendatario_morada_atual: 'Rua Anterior, n.º 2, Porto',
      arrendatario_email: 'arrendataria@exemplo.invalid',
      imovel_tipologia: 'T2',
      imovel_fracao: 'B',
      imovel_morada: 'Rua do Locado, n.º 3, Lisboa',
      imovel_freguesia: 'Arroios',
      imovel_concelho: 'Lisboa',
      imovel_conservatoria: 'Lisboa',
      imovel_descricao_registo: '1111/20000101',
      imovel_artigo_matricial: '2222',
      imovel_licenca_utilizacao: '00/1999',
      imovel_certificado_energetico: 'SCE111111111',
      mobilado: '',
      obras_previas: '',
      prazo_meses: '12',
      data_inicio: '01/09/2026',
      renda_valor: '650,00',
      renda_dia_pagamento: '8',
      caucao: '',
      animais_permitidos: '',
      fiador: '',
      foro_comarca: 'Lisboa',
      contrato_local: 'Lisboa',
      contrato_data: '01/09/2026',
    };
    const result = validateTemplateValues({ paragraphs, meta: meta!, fieldTypes, values, todayIso: '2026-09-01', tagErrors });
    expect(result.structuralErrors).toEqual([]);
    expect(result.hasBlockingError).toBe(false);
  });
});

describe('validateTemplateValues — empreitada passes with a complete valid demo set', () => {
  it('has zero blocking errors', () => {
    const { paragraphs, tagErrors, meta, fieldTypes } = loadParsed('empreitada');
    const values: Record<string, string> = {
      dono_obra_nome: 'Carlos Exemplo Neves',
      dono_obra_estado_civil: 'casado, comunhão de adquiridos',
      dono_obra_nif: '252601815',
      dono_obra_morada: 'Rua do Dono da Obra, n.º 1, Lisboa',
      dono_obra_email: 'dono@exemplo.invalid',
      empreiteiro_nome: 'Construções Exemplo, Lda.',
      empreiteiro_nipc: '566131862',
      empreiteiro_alvara: '00000/2010',
      empreiteiro_morada: 'Rua do Empreiteiro, n.º 2, Lisboa',
      empreiteiro_email: 'empreiteiro@exemplo.invalid',
      obra_descricao: 'remodelação integral de cozinha e casa de banho',
      obra_local: 'Rua da Obra, n.º 3, Lisboa',
      obra_freguesia: 'Arroios',
      obra_concelho: 'Lisboa',
      preco_total: '15.000,00',
      preco_iva_incluido: 'sim',
      adiantamento: '',
      pagamento_faseado: '',
      retencao_garantia: '',
      data_inicio: '01/09/2026',
      prazo_dias: '60',
      materiais_por_conta: 'conta do Empreiteiro',
      seguro_obra: '',
      penalizacao_atraso: '',
      garantia_anos: '5',
      foro_comarca: 'Lisboa',
      contrato_local: 'Lisboa',
      contrato_data: '01/09/2026',
    };
    const result = validateTemplateValues({ paragraphs, meta: meta!, fieldTypes, values, todayIso: '2026-09-01', tagErrors });
    expect(result.structuralErrors).toEqual([]);
    expect(result.hasBlockingError).toBe(false);
  });
});

describe('validateTemplateValues — procuracao passes with a complete valid demo set', () => {
  it('has zero blocking errors', () => {
    const { paragraphs, tagErrors, meta, fieldTypes } = loadParsed('procuracao');
    const values: Record<string, string> = {
      mandante_nome: 'Carlos Exemplo Neves',
      mandante_estado_civil: 'casado, comunhão de adquiridos',
      mandante_nif: '252601815',
      mandante_cc: '123456789ZZ4',
      mandante_cc_validade: '20/05/2031',
      mandante_morada: 'Rua do Mandante, n.º 1, Lisboa',
      mandatario_nome: 'Beatriz Exemplo Santos',
      mandatario_estado_civil: 'solteira, maior',
      mandatario_nif: '259083011',
      mandatario_cc: '111111111ZZ1',
      mandatario_cc_validade: '02/11/2030',
      mandatario_morada: 'Rua do Mandatário, n.º 2, Lisboa',
      poderes_descricao: 'representar o Mandante junto de repartições públicas',
      finalidade: '',
      prazo_definido: 'sim',
      prazo_data_fim: '31/12/2027',
      poderes_substabelecer: '',
      reconhecimento: '',
      contrato_local: 'Lisboa',
      contrato_data: '01/09/2026',
    };
    const result = validateTemplateValues({ paragraphs, meta: meta!, fieldTypes, values, todayIso: '2026-09-01', tagErrors });
    expect(result.structuralErrors).toEqual([]);
    expect(result.hasBlockingError).toBe(false);
  });

  it('flags prazo_data_fim before contrato_data as a blocking error (date_after rule)', () => {
    const { paragraphs, tagErrors, meta, fieldTypes } = loadParsed('procuracao');
    const values: Record<string, string> = {
      mandante_nome: 'Carlos Exemplo Neves',
      mandante_estado_civil: 'casado, comunhão de adquiridos',
      mandante_nif: '252601815',
      mandante_cc: '123456789ZZ4',
      mandante_cc_validade: '20/05/2031',
      mandante_morada: 'Rua do Mandante, n.º 1, Lisboa',
      mandatario_nome: 'Beatriz Exemplo Santos',
      mandatario_estado_civil: 'solteira, maior',
      mandatario_nif: '259083011',
      mandatario_cc: '111111111ZZ1',
      mandatario_cc_validade: '02/11/2030',
      mandatario_morada: 'Rua do Mandatário, n.º 2, Lisboa',
      poderes_descricao: 'representar o Mandante junto de repartições públicas',
      finalidade: '',
      prazo_definido: 'sim',
      prazo_data_fim: '01/01/2020',
      poderes_substabelecer: '',
      reconhecimento: '',
      contrato_local: 'Lisboa',
      contrato_data: '01/09/2026',
    };
    const result = validateTemplateValues({ paragraphs, meta: meta!, fieldTypes, values, todayIso: '2026-09-01', tagErrors });
    expect(result.hasBlockingError).toBe(true);
  });
});
