import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDocx } from '../../../../src/core/docx/build';
import { readDocx } from '../../../../src/core/docx/read';

const CPCV_DOCX = join(__dirname, '../../../../templates/cpcv/template.docx');
const DISCLAIMER = 'Pré-visualização aproximada; sem valor legal.';

const VALUES: Record<string, string> = {
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

describe('buildDocx — real CPCV template', () => {
  it('produces a valid .docx with values substituted, no leftover tags, and the disclaimer appended', () => {
    const doc = readDocx(readFileSync(CPCV_DOCX));
    const bytes = buildDocx({ doc, values: VALUES, disclaimerText: DISCLAIMER });

    const rebuilt = readDocx(bytes);
    const fullText = rebuilt.paragraphs.map((p) => p.text).join('\n');

    expect(fullText).toContain('Maria Exemplo Silva');
    expect(fullText).toContain('235.000,00');
    expect(fullText).not.toMatch(/\{\{/); // no leftover tag syntax anywhere
    expect(fullText).toContain('PRIMEIRA'); // {{cl}} rendered
    expect(fullText).toContain(DISCLAIMER);

    // onus=true -> its conditional content is visible.
    expect(fullText).toContain('hipoteca voluntária');
    // arrendado='' -> the #senao branch (no-arrendamento declaration) renders instead.
    expect(fullText).toContain('não foi celebrado qualquer contrato de arrendamento');
  });

  it('same bytes drive both "preview" and "download" — building twice from the same input is deterministic', () => {
    const doc1 = readDocx(readFileSync(CPCV_DOCX));
    const doc2 = readDocx(readFileSync(CPCV_DOCX));
    const bytesA = buildDocx({ doc: doc1, values: VALUES, disclaimerText: DISCLAIMER });
    const bytesB = buildDocx({ doc: doc2, values: VALUES, disclaimerText: DISCLAIMER });

    const textA = readDocx(bytesA).paragraphs.map((p) => p.text).join('\n');
    const textB = readDocx(bytesB).paragraphs.map((p) => p.text).join('\n');
    expect(textA).toBe(textB);
  });

  it('hides content when a condition flips, and the block-marker paragraphs never survive', () => {
    const doc = readDocx(readFileSync(CPCV_DOCX));
    const values = { ...VALUES, onus: '' };
    const bytes = buildDocx({ doc, values, disclaimerText: DISCLAIMER });
    const fullText = readDocx(bytes).paragraphs.map((p) => p.text).join('\n');

    expect(fullText).not.toContain('hipoteca voluntária');
    expect(fullText).not.toMatch(/\{\{#|\{\{\/|\{\{cl|\{\{pt|\{\{al/);
  });
});
