import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDocx } from '../../../../src/core/docx/build';
import { readDocx } from '../../../../src/core/docx/read';
import { parseTemplate } from '../../../../src/core/tags/parse';
import { analyzeBlocks, findHiddenRefs } from '../../../../src/core/numbering/blocks';

const DOCX = join(__dirname, '../../../../templates/empreitada/template.docx');
const DISCLAIMER = 'Pré-visualização aproximada.';

const BASE_VALUES: Record<string, string> = {
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

describe('templates/empreitada — tag grammar and numbering', () => {
  it('is free of tag-grammar and hidden-ref errors', () => {
    const doc = readDocx(readFileSync(DOCX));
    const rawBody = doc.paragraphs.map((p) => ({ location: 'body' as const, text: p.text }));
    const { paragraphs, errors } = parseTemplate(rawBody);
    expect(errors).toEqual([]);
    expect(findHiddenRefs(analyzeBlocks(paragraphs))).toEqual([]);
  });
});

describe('templates/empreitada — buildDocx golden output', () => {
  it('substitutes all values and resolves the minimal (all-false-block) path with no leftover tags', () => {
    const doc = readDocx(readFileSync(DOCX));
    const bytes = buildDocx({ doc, values: BASE_VALUES, disclaimerText: DISCLAIMER });
    const text = readDocx(bytes).paragraphs.map((p) => p.text).join('\n');

    expect(text).not.toMatch(/\{\{/);
    expect(text).toContain('Construções Exemplo, Lda.');
    expect(text).toContain('15.000,00');
    expect(text).toContain('PRIMEIRA');
    expect(text).toContain('inclui o Imposto sobre o Valor Acrescentado');
    // pagamento_faseado='' -> #senao branch
    expect(text).toContain('pago integralmente após a receção provisória');
    // adiantamento/retencao/seguro/penalizacao all '' -> those clauses/points absent
    expect(text).not.toContain('a título de adiantamento');
    expect(text).not.toContain('Seguro de obra');
    expect(text).not.toContain('Penalização por atraso');
  });

  it('renders every conditional clause when its condition is true', () => {
    const doc = readDocx(readFileSync(DOCX));
    const values = {
      ...BASE_VALUES,
      preco_iva_incluido: '',
      adiantamento: 'sim',
      adiantamento_valor: '3.000,00',
      pagamento_faseado: 'sim',
      pagamento_condicoes: '50% no início, 50% na conclusão',
      retencao_garantia: 'sim',
      retencao_percentagem: '10',
      seguro_obra: 'sim',
      seguradora_nome: 'Seguradora Exemplo',
      penalizacao_atraso: 'sim',
      penalizacao_valor_dia: '50,00',
    };
    const bytes = buildDocx({ doc, values, disclaimerText: DISCLAIMER });
    const text = readDocx(bytes).paragraphs.map((p) => p.text).join('\n');

    expect(text).toContain('acresce o Imposto sobre o Valor Acrescentado');
    expect(text).toContain('3.000,00');
    expect(text).toContain('50% no início, 50% na conclusão');
    expect(text).toContain('reter 10%');
    expect(text).toContain('Seguradora Exemplo');
    expect(text).toContain('50,00');
    expect(text).not.toMatch(/\{\{/);
  });
});
