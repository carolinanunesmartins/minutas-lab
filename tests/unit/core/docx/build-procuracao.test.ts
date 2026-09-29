import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDocx } from '../../../../src/core/docx/build';
import { readDocx } from '../../../../src/core/docx/read';
import { parseTemplate } from '../../../../src/core/tags/parse';
import { analyzeBlocks, findHiddenRefs } from '../../../../src/core/numbering/blocks';

const DOCX = join(__dirname, '../../../../templates/procuracao/template.docx');
const DISCLAIMER = 'Pré-visualização aproximada.';

const BASE_VALUES: Record<string, string> = {
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
  poderes_descricao: 'representar o Mandante junto de repartições públicas e assinar a documentação necessária',
  finalidade: '',
  prazo_definido: '',
  poderes_substabelecer: '',
  reconhecimento: '',
  contrato_local: 'Lisboa',
  contrato_data: '01/09/2026',
};

describe('templates/procuracao — tag grammar and numbering', () => {
  it('is free of tag-grammar and hidden-ref errors', () => {
    const doc = readDocx(readFileSync(DOCX));
    const rawBody = doc.paragraphs.map((p) => ({ location: 'body' as const, text: p.text }));
    const { paragraphs, errors } = parseTemplate(rawBody);
    expect(errors).toEqual([]);
    expect(findHiddenRefs(analyzeBlocks(paragraphs))).toEqual([]);
  });
});

describe('templates/procuracao — buildDocx golden output', () => {
  it('resolves the indefinite/no-substabelecimento/no-reconhecimento path with no leftover tags', () => {
    const doc = readDocx(readFileSync(DOCX));
    const bytes = buildDocx({ doc, values: BASE_VALUES, disclaimerText: DISCLAIMER });
    const text = readDocx(bytes).paragraphs.map((p) => p.text).join('\n');

    expect(text).not.toMatch(/\{\{/);
    expect(text).toContain('Carlos Exemplo Neves');
    expect(text).toContain('Beatriz Exemplo Santos');
    expect(text).toContain('PRIMEIRA');
    expect(text).toContain('vigora por tempo indeterminado');
    expect(text).toContain('não pode substabelecer');
    expect(text).toContain('sem reconhecimento presencial');
    expect(text).not.toContain('finalidade específica');
    expect(text).toContain(DISCLAIMER);
  });

  it('resolves the definite-term/substabelecimento/reconhecimento path', () => {
    const doc = readDocx(readFileSync(DOCX));
    const values = {
      ...BASE_VALUES,
      finalidade: 'sim',
      finalidade_descricao: 'venda de um veículo automóvel',
      prazo_definido: 'sim',
      prazo_data_fim: '31/12/2027',
      poderes_substabelecer: 'sim',
      reconhecimento: 'sim',
      reconhecimento_entidade: 'advogado com inscrição em vigor',
    };
    const bytes = buildDocx({ doc, values, disclaimerText: DISCLAIMER });
    const text = readDocx(bytes).paragraphs.map((p) => p.text).join('\n');

    expect(text).toContain('venda de um veículo automóvel');
    expect(text).toContain('31/12/2027');
    expect(text).toContain('pode substabelecer');
    expect(text).toContain('reconhecida presencialmente por advogado');
    expect(text).not.toMatch(/\{\{/);
  });
});
