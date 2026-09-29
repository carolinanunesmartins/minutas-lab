// REQ-UI (SPEC.md §7): every user-facing string lives here, pt-PT.
export const messages = {
  appTitle: 'minutas-lab',
  appTagline: 'Preencha o formulário e veja a pré-visualização da minuta em tempo real.',

  pickTemplateTitle: 'Escolha uma minuta',
  pickTemplateHint: 'Selecione o tipo de contrato que pretende preencher.',
  changeTemplate: 'Escolher outra minuta',

  loading: 'A carregar a minuta…',
  loadError: 'Não foi possível carregar a minuta. Recarregue a página.',

  formTitle: 'Dados',
  previewTitle: 'Pré-visualização',
  previewApprox: 'Pré-visualização aproximada — o ficheiro descarregado é a versão final.',
  previewEmpty: 'Preencha os campos para ver a pré-visualização.',

  fieldRequired: 'Campo obrigatório.',
  fieldFormatInvalid: 'Formato inválido.',
  fieldFormatInvalidWarning: 'Formato não verificado (funcionalidade experimental).',

  ruleSumEq: 'A soma dos valores não corresponde ao total indicado.',
  ruleDateAfter: 'A data deve ser posterior à data de referência.',
  ruleDateBefore: 'A data deve ser anterior à data de referência.',
  ruleDiffers: 'Os dois valores não devem ser iguais.',

  structuralErrorsTitle: 'Esta minuta tem um problema de configuração e não pode ser gerada.',

  downloadFinal: 'Descarregar minuta',
  downloadDraft: 'Descarregar rascunho',
  downloadDisabledReason: 'Corrija os erros assinalados para descarregar a versão final.',

  reviewTitle: 'Rever antes de descarregar',
  reviewBody: 'Confirma que os dados estão corretos? Depois de descarregada, a minuta não fica guardada em lado nenhum — reveja com atenção.',
  reviewConfirm: 'Confirmar e descarregar',
  reviewCancel: 'Cancelar',

  draftNote:
    'RASCUNHO — documento incompleto ou não revisto. Os campos por preencher estão destacados a amarelo. Não use esta versão como definitiva.',
  disclaimer:
    'Este documento foi gerado automaticamente a partir dos dados introduzidos e da minuta selecionada. É uma pré-visualização aproximada e não constitui aconselhamento jurídico; reveja o conteúdo antes de o utilizar.',

  beforeUnloadWarning: 'Os dados introduzidos não são guardados. Se sair, perdê-los-á.',

  uploadErrorFileTooLarge: 'O ficheiro é demasiado grande.',
  uploadErrorNotAZip: 'O ficheiro não é um documento .docx válido.',
  uploadErrorTooManyEntries: 'O ficheiro tem uma estrutura interna inválida (demasiadas entradas).',
  uploadErrorEntryTooLarge: 'O ficheiro tem uma entrada interna demasiado grande.',
  uploadErrorTotalTooLarge: 'O ficheiro excede o limite de tamanho após descompressão.',
  uploadErrorMissingDocumentXml: 'O ficheiro não é um documento Word válido.',
  uploadErrorMalformedXml: 'O ficheiro está corrompido ou malformado.',
  uploadErrorGeneric: 'Não foi possível processar o ficheiro.',

  groupUnlabeled: 'Outros campos',

  extractPanelToggleOpen: 'Preencher a partir de texto colado (com IA)',
  extractPanelToggleClose: 'Fechar preenchimento por IA',
  extractApiKeyLabel: 'Chave da API (Anthropic)',
  extractApiKeyHelp: 'Fica apenas em memória enquanto esta página estiver aberta — nunca é guardada.',
  extractApiKeyPlaceholder: 'sk-ant-…',
  extractTextLabel: 'Texto a analisar',
  extractTextHelp: 'Cole aqui o texto de onde quer extrair valores para os campos (máx. 20 000 carateres).',
  extractSubmit: 'Extrair campos',
  extractSubmitting: 'A extrair…',
  extractDisclaimer: 'As propostas nunca são aplicadas automaticamente. Reveja cada uma e confirme campo a campo.',
  extractNoProposals: 'Não foram propostos valores com fundamentação suficiente no texto.',
  extractRejectedSummary: 'propostas rejeitadas por falta de fundamentação no texto (não são mostradas).',
  extractAccept: 'Aceitar',
  extractDiscard: 'Descartar',
  extractAccepted: 'Aplicado',
  extractOverwriteWarning: 'Este campo já tem um valor — aceitar substitui-o.',
  extractQuoteLabel: 'Citação encontrada no texto:',
  extractErrorGeneric: 'Não foi possível extrair valores. Verifique a chave da API e tente novamente.',
} as const;
