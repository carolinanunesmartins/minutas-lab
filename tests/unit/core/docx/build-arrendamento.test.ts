import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDocx } from '../../../../src/core/docx/build';
import { readDocx } from '../../../../src/core/docx/read';
import { parseTemplate } from '../../../../src/core/tags/parse';
import { analyzeBlocks, findHiddenRefs } from '../../../../src/core/numbering/blocks';

const DOCX = join(__dirname, '../../../../templates/arrendamento/template.docx');
const DISCLAIMER = 'Pré-visualização aproximada.';

const BASE_VALUES: Record<string, string> = {
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
  caucao: 'sim',
  caucao_valor: '650,00',
  animais_permitidos: '',
  fiador: '',
  foro_comarca: 'Lisboa',
  contrato_local: 'Lisboa',
  contrato_data: '01/09/2026',
};

describe('templates/arrendamento — tag grammar and numbering', () => {
  it('is free of tag-grammar and hidden-ref errors', () => {
    const doc = readDocx(readFileSync(DOCX));
    const rawBody = doc.paragraphs.map((p) => ({ location: 'body' as const, text: p.text }));
    const { paragraphs, errors } = parseTemplate(rawBody);
    expect(errors).toEqual([]);
    expect(findHiddenRefs(analyzeBlocks(paragraphs))).toEqual([]);
  });
});

describe('templates/arrendamento — buildDocx golden output', () => {
  it('substitutes all values, resolves conditionals and numbering, with no leftover tags', () => {
    const doc = readDocx(readFileSync(DOCX));
    const bytes = buildDocx({ doc, values: BASE_VALUES, disclaimerText: DISCLAIMER });
    const text = readDocx(bytes).paragraphs.map((p) => p.text).join('\n');

    expect(text).not.toMatch(/\{\{/);
    expect(text).toContain('Carlos Exemplo Neves');
    expect(text).toContain('650,00');
    expect(text).toContain('PRIMEIRA'); // {{cl}} numbering
    // mobilado='' -> #senao branch
    expect(text).toContain('sem mobiliário');
    // animais_permitidos='' -> #senao branch
    expect(text).toContain('Não é permitida a permanência de animais');
    // caucao='sim' -> conditional clause present
    expect(text).toContain('título de caução');
    // fiador='' -> whole conditional clause absent
    expect(text).not.toContain('constitui-se fiador');
    expect(text).toContain(DISCLAIMER);
  });

  it('renders the fiador clause and mobiliário inventory when those conditions are true', () => {
    const doc = readDocx(readFileSync(DOCX));
    const values = {
      ...BASE_VALUES,
      mobilado: 'sim',
      mobiliario_descricao: 'cama, sofá e eletrodomésticos de cozinha',
      fiador: 'sim',
      fiador_nome: 'Duarte Exemplo Fiador',
      fiador_nif: '252601815',
      fiador_morada: 'Rua do Fiador, n.º 4, Lisboa',
    };
    const bytes = buildDocx({ doc, values, disclaimerText: DISCLAIMER });
    const text = readDocx(bytes).paragraphs.map((p) => p.text).join('\n');

    expect(text).toContain('cama, sofá e eletrodomésticos de cozinha');
    expect(text).toContain('Duarte Exemplo Fiador');
    expect(text).toContain('constitui-se fiador');
    expect(text).not.toMatch(/\{\{/);
  });
});
