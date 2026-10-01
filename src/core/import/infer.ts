// M8: turn detected blanks into proposed fields (id, label, type, group) using
// pt-PT keyword heuristics over the blank's label and left context. Proposals
// only — the review UI lets the user change every one of them.
import type { TagModifier, TagType } from '../tags/types';
import { ID_PATTERN } from '../tags/types';
import type { Blank } from './detect';

export interface InferredField {
  /** Stable key used by blanks to reference this field (the initially proposed id). */
  key: string;
  id: string;
  label: string;
  type: TagType;
  group: string;
  options?: string[];
}

export interface InferredBlank {
  blank: Blank;
  fieldKey: string;
  modifier?: TagModifier;
}

export interface InferResult {
  blanks: InferredBlank[];
  fields: InferredField[];
}

export const ESTADO_CIVIL_OPTIONS = [
  'Solteiro(a), maior',
  'Casado(a) em comunhão de adquiridos',
  'Casado(a) em comunhão geral de bens',
  'Casado(a) em separação de bens',
  'Divorciado(a)',
  'Viúvo(a)',
  'União de facto',
];

export const REGIME_BENS_OPTIONS = ['Comunhão de adquiridos', 'Comunhão geral de bens', 'Separação de bens'];

/** Lowercase, accent-free, for keyword matching. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

interface Role {
  key: string;
  label: string;
  re: RegExp;
}

const ROLES: Role[] = [
  { key: 'vendedor', label: 'Promitente-Vendedor', re: /vendedor|primeiro outorgante/ },
  { key: 'comprador', label: 'Promitente-Comprador', re: /comprador|segundo outorgante/ },
  { key: 'senhorio', label: 'Senhorio', re: /senhorio|locador/ },
  { key: 'arrendatario', label: 'Arrendatário', re: /arrendatario|inquilino|locatario/ },
  { key: 'mandante', label: 'Mandante', re: /mandante/ },
  { key: 'mandatario', label: 'Mandatário', re: /mandatario|procurador/ },
  { key: 'dono_obra', label: 'Dono da obra', re: /dono da obra|dono de obra/ },
  { key: 'empreiteiro', label: 'Empreiteiro', re: /empreiteiro/ },
];

const IMOVEL_RE = /imovel|fracao|predio|artigo matricial|matriz|descricao predial|conservatoria/;

interface Rule {
  re: RegExp;
  name: string;
  type: TagType;
  /** Person-related: prefixed with the current role (vendedor_nome). */
  person?: boolean;
  options?: string[];
  fieldLabel: string;
}

// First match wins, so specific rules precede general ones.
const RULES: Rule[] = [
  { re: /nascimento/, name: 'data_nascimento', type: 'data', person: true, fieldLabel: 'Data de nascimento' },
  { re: /valido ate|validade/, name: 'validade', type: 'data', person: true, fieldLabel: 'Validade do documento' },
  { re: /\bbanco\b/, name: 'banco', type: 'text', person: true, fieldLabel: 'Banco' },
  { re: /^(numero de )?dias?\b/, name: 'dias', type: 'int', fieldLabel: 'Dias' },
  { re: /iban/, name: 'iban', type: 'iban', person: true, fieldLabel: 'IBAN' },
  { re: /nipc/, name: 'nipc', type: 'nipc', person: true, fieldLabel: 'NIPC' },
  { re: /\bnif\b|contribuinte/, name: 'nif', type: 'nif', person: true, fieldLabel: 'NIF' },
  { re: /cartao de cidadao|\bcc\b|digitos de confirmacao/, name: 'cc', type: 'cc', person: true, fieldLabel: 'N.º do Cartão de Cidadão' },
  { re: /estado civil/, name: 'estado_civil', type: 'text', person: true, options: ESTADO_CIVIL_OPTIONS, fieldLabel: 'Estado civil' },
  { re: /regime de bens|regime matrimonial/, name: 'regime_bens', type: 'text', person: true, options: REGIME_BENS_OPTIONS, fieldLabel: 'Regime de bens' },
  { re: /freguesia/, name: 'freguesia', type: 'text', person: true, fieldLabel: 'Freguesia' },
  { re: /concelho|municipio/, name: 'concelho', type: 'text', person: true, fieldLabel: 'Concelho' },
  { re: /codigo postal/, name: 'codigo_postal', type: 'text', person: true, fieldLabel: 'Código postal' },
  { re: /morada|residente|domicilio|sede|endereco/, name: 'morada', type: 'text', person: true, fieldLabel: 'Morada' },
  { re: /profissao/, name: 'profissao', type: 'text', person: true, fieldLabel: 'Profissão' },
  { re: /nacionalidade/, name: 'nacionalidade', type: 'text', person: true, fieldLabel: 'Nacionalidade' },
  { re: /e-?mail|correio eletronico/, name: 'email', type: 'text', person: true, fieldLabel: 'Email' },
  { re: /telefone|telemovel|contacto/, name: 'telefone', type: 'text', person: true, fieldLabel: 'Telefone' },
  { re: /preco|sinal|montante|quantia|remanescente|a pagar|\brenda\b|\bvalor\b|euros|€/, name: 'valor', type: 'eur', fieldLabel: 'Valor' },
  { re: /dias|prazo|meses|anos|permilagem|area|percentagem/, name: 'numero', type: 'int', fieldLabel: 'Número' },
  { re: /\bdata\b/, name: 'data', type: 'data', fieldLabel: 'Data' },
  { re: /nome|denominacao|firma|outorgante/, name: 'nome', type: 'text', person: true, fieldLabel: 'Nome' },
];

const STOPWORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'o', 'a', 'os', 'as', 'e', 'em', 'no', 'na', 'inserir', 'indicar', 'preencher', 'escrever', 'todos', 'ao']);

function slug(s: string): string {
  return normalize(s)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('pt-PT') + s.slice(1);
}

/** Text that explains an unlabeled blank: the last few words before it. */
function leftWords(left: string): string {
  const afterPunct = left.split(/[.;:!?()\n]/).pop() ?? left;
  return afterPunct.trim().split(/\s+/).slice(-4).join(' ');
}

function findRole(normText: string): Role | undefined {
  return ROLES.find((r) => r.re.test(normText));
}

function fallbackName(label: string): string {
  return normalize(label)
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .slice(0, 4)
    .join('_');
}

const ROLE_WORDS = new Set([
  'vendedor', 'comprador', 'promitente', 'outorgante', 'primeiro', 'segundo', 'senhorio', 'locador', 'arrendatario',
  'inquilino', 'locatario', 'mandante', 'mandatario', 'procurador', 'dono', 'obra', 'empreiteiro', 'fiador',
]);

/** Label words minus stopwords and role words, for label-derived ids. */
function labelBase(normHint: string): string {
  return normHint
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOPWORDS.has(w) && !ROLE_WORDS.has(w))
    .slice(0, 4)
    .join('_');
}

const EXTENSO_SUFFIX = /\s*(\(?\s*)?por extenso\)?\s*$/;

export function inferFields(blanks: readonly Blank[]): InferResult {
  const fields = new Map<string, InferredField>();
  /** role|normalized label -> field key: the same question asked twice is one field. */
  const byQuestion = new Map<string, string>();
  const out: InferredBlank[] = [];
  let currentRole: Role | undefined;
  let unnamed = 0;
  let prev: { blank: Blank; fieldKey: string; type: TagType } | undefined;

  for (const blank of blanks) {
    const hint = blank.label ?? leftWords(blank.left);
    // Leading instruction verbs ("inserir freguesia") are noise for matching and dedupe.
    const normHint = normalize(hint)
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(inserir|indicar|preencher|escrever|introduzir)\s+/, '');

    const labelRole = findRole(normHint);
    if (labelRole) {
      currentRole = labelRole;
    } else {
      const leftRole = findRole(normalize(blank.left).slice(-40));
      if (leftRole) currentRole = leftRole;
    }

    // "[valor por extenso]": same field as the amount it spells out, `extenso` modifier.
    if (/extenso/.test(normHint)) {
      const base = normHint.replace(EXTENSO_SUFFIX, '').trim();
      const known = Array.from(byQuestion.entries()).find(([k]) => k.endsWith(`|${base}`) && base !== '');
      const target = known ? fields.get(known[1]) : undefined;
      if (target && (target.type === 'eur' || target.type === 'int')) {
        out.push({ blank, fieldKey: target.key, modifier: 'extenso' });
        prev = undefined;
        continue;
      }
      if (prev && prev.blank.paraIndex === blank.paraIndex && (prev.type === 'eur' || prev.type === 'int')) {
        out.push({ blank, fieldKey: prev.fieldKey, modifier: 'extenso' });
        prev = undefined;
        continue;
      }
    }

    // Date blanks keep type `data`; the table may still give them a more specific name (validade, nascimento).
    // A label listing several things ("Arrendatário, tipo, prazo e última renda") is free text, whatever keywords it contains.
    const isList = blank.kind !== 'date' && (normHint.match(/,/g) ?? []).length >= 2;
    const matched = isList
      ? undefined
      : blank.kind === 'date'
        ? RULES.find((r) => r.type === 'data' && r.re.test(normHint))
        : RULES.find((r) => r.re.test(normHint));

    let name: string;
    let type: TagType;
    let label: string;
    let person = false;
    let options: string[] | undefined;
    if (matched) {
      name = matched.name;
      type = matched.type;
      person = matched.person === true;
      options = matched.options;
      label = blank.label ? capitalize(blank.label) : matched.fieldLabel;
    } else if (blank.kind === 'date') {
      name = 'data';
      type = 'data';
      label = blank.label ? capitalize(blank.label) : 'Data';
    } else {
      name = fallbackName(hint);
      if (!name) {
        unnamed += 1;
        name = `campo_${unnamed}`;
      }
      type = 'text';
      label = blank.label ? capitalize(blank.label) : capitalize(hint || name.replace(/_/g, ' '));
    }

    let prefix = '';
    if (IMOVEL_RE.test(normHint)) prefix = 'imovel';
    else if (person && currentRole) prefix = currentRole.key;
    else if (labelRole) prefix = labelRole.key;

    let group = 'Geral';
    if (prefix === 'imovel') group = 'Imóvel';
    else if (prefix && currentRole?.key === prefix) group = currentRole.label;

    const question = `${prefix}|${normHint}`;
    const known = byQuestion.get(question);
    if (known !== undefined) {
      out.push({ blank, fieldKey: known });
      prev = { blank, fieldKey: known, type: fields.get(known)?.type ?? type };
      continue;
    }

    // Pretty id from the matched rule; if another question already took it, fall back to the label's own words.
    const make = (n: string): string => {
      const raw = slug(prefix ? `${prefix}_${n}` : n);
      return ID_PATTERN.test(raw) ? raw : `campo_${raw}`;
    };
    let key = make(name);
    if (fields.has(key)) {
      const fromLabel = labelBase(normHint);
      if (fromLabel) key = make(fromLabel);
      let n = 2;
      const first = key;
      while (fields.has(key)) {
        key = `${first}_${n}`;
        n += 1;
      }
    }
    fields.set(key, { key, id: key, label, type, group, ...(options && { options }) });
    byQuestion.set(question, key);
    out.push({ blank, fieldKey: key });
    prev = { blank, fieldKey: key, type };
  }

  return { blanks: out, fields: Array.from(fields.values()) };
}
