// Synthetic, format-valid values (real NIF/NIPC/IBAN/CC checksums, invented
// people and addresses) used only by the "fill with test data" button.
// Dates are relative to today so date rules (e.g. "deadline in the future")
// keep passing whenever this runs.
// Checksum-valid numbers can coincide with real ones (Portugal has no reserved
// test range, SPEC.md §6): they are placeholders for a demo, never real people's data.

const SOLTEIRO = 'Solteiro(a), maior';
const CASADO = 'Casado(a) em comunhão de adquiridos';

function pt(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

function daysFrom(today: Date, days: number): Date {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d;
}

function yearsFrom(today: Date, years: number): Date {
  const d = new Date(today);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

const BUILDERS: Record<string, (today: Date) => Record<string, string>> = {
  cpcv: (today) => ({
    vendedor_nome: 'Maria Exemplo Silva',
    vendedor_estado_civil: SOLTEIRO,
    vendedor_freguesia_naturalidade: 'Santa Maria dos Olivais',
    vendedor_concelho_naturalidade: 'Lisboa',
    vendedor_nif: '252601815',
    vendedor_cc: '123456789ZZ4',
    vendedor_cc_validade: pt(yearsFrom(today, 5)),
    vendedor_morada: 'Rua das Flores, n.º 10, 1.º Esq., 2300-000 Tomar',
    vendedor_email: 'vendedor@exemplo.invalid',
    vendedor_iban: 'PT50999946281948219935123',
    vendedor_banco: 'Banco Exemplo',
    comprador_nome: 'João Teste Costa',
    comprador_estado_civil: SOLTEIRO,
    comprador_freguesia_naturalidade: 'São João Baptista',
    comprador_concelho_naturalidade: 'Tomar',
    comprador_nif: '259083011',
    comprador_cc: '111111111ZZ1',
    comprador_cc_validade: pt(yearsFrom(today, 4)),
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
    imovel_certificado_validade: pt(yearsFrom(today, 6)),
    imovel_licenca_utilizacao: '00/2000',
    imovel_licenca_data: '15/06/2000',
    imovel_licenca_camara: 'Tomar',
    onus_prorrogacao_dias: '30',
    preco_total: '235.000,00',
    sinal_valor: '23.500,00',
    remanescente_valor: '211.500,00',
    escritura_data_limite: pt(daysFrom(today, 90)),
    aviso_dias: '8',
    incumprimento_prazo_dias: '10',
    documentos_prazo_dias: '2',
    condominio_prazo_dias: '20',
    domicilio_prazo_dias: '15',
    foro_comarca: 'Santarém',
    contrato_local: 'Tomar',
    contrato_data: pt(today),
  }),
  arrendamento: (today) => ({
    senhorio_nome: 'Carlos Exemplo Neves',
    senhorio_estado_civil: CASADO,
    senhorio_nif: '252601815',
    senhorio_morada: 'Rua do Senhorio, n.º 1, Lisboa',
    senhorio_iban: 'PT50999946281948219935123',
    senhorio_banco: 'Banco Exemplo',
    senhorio_email: 'senhorio@exemplo.invalid',
    arrendatario_nome: 'Beatriz Exemplo Santos',
    arrendatario_estado_civil: SOLTEIRO,
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
    prazo_meses: '12',
    data_inicio: pt(daysFrom(today, 30)),
    renda_valor: '650,00',
    renda_dia_pagamento: '8',
    caucao: 'true',
    caucao_valor: '650,00',
    foro_comarca: 'Lisboa',
    contrato_local: 'Lisboa',
    contrato_data: pt(today),
  }),
  empreitada: (today) => ({
    dono_obra_nome: 'Carlos Exemplo Neves',
    dono_obra_estado_civil: CASADO,
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
    preco_iva_incluido: 'true',
    data_inicio: pt(daysFrom(today, 30)),
    prazo_dias: '60',
    materiais_por_conta: 'conta do Empreiteiro',
    garantia_anos: '5',
    foro_comarca: 'Lisboa',
    contrato_local: 'Lisboa',
    contrato_data: pt(today),
  }),
  procuracao: (today) => ({
    mandante_nome: 'Carlos Exemplo Neves',
    mandante_estado_civil: CASADO,
    mandante_nif: '252601815',
    mandante_cc: '123456789ZZ4',
    mandante_cc_validade: pt(yearsFrom(today, 5)),
    mandante_morada: 'Rua do Mandante, n.º 1, Lisboa',
    mandatario_nome: 'Beatriz Exemplo Santos',
    mandatario_estado_civil: SOLTEIRO,
    mandatario_nif: '259083011',
    mandatario_cc: '111111111ZZ1',
    mandatario_cc_validade: pt(yearsFrom(today, 4)),
    mandatario_morada: 'Rua do Mandatário, n.º 2, Lisboa',
    poderes_descricao: 'representar o Mandante junto de repartições públicas e assinar a documentação necessária',
    contrato_local: 'Lisboa',
    contrato_data: pt(today),
  }),
};

/** Test values for a template (by `meta.id`), or an empty object if none are defined. */
export function dummyValuesFor(templateId: string, today: Date = new Date()): Record<string, string> {
  return BUILDERS[templateId]?.(today) ?? {};
}
