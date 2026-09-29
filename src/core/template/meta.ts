// REQ-REPO / template package (SPEC.md §5). Hand-written structural
// validation (no schema library — AGENTS.md §4 rule 10, minimal deps).

export interface FieldMeta {
  label?: string;
  group?: string;
  help?: string;
  required?: boolean;
  default?: string;
  emptyText?: string;
}

export interface GroupMeta {
  id: string;
  label: string;
  order: number;
}

export type Severity = 'error' | 'warning';

export type Rule =
  | { type: 'sum_eq'; fields: string[]; total: string; severity: Severity }
  | { type: 'date_after' | 'date_before'; field: string; than: string; severity: Severity }
  | { type: 'differs'; a: string; b: string; severity: Severity }
  | { type: 'required_if'; field: string; when: { field: string; equals?: string; nonEmpty?: boolean } };

export interface Meta {
  id: string;
  title: string;
  version: string;
  fields: Record<string, FieldMeta>;
  groups?: GroupMeta[];
  rules?: Rule[];
}

export type MetaErrorCode = 'META_INVALID_SHAPE' | 'META_UNKNOWN_FIELD';

export interface MetaError {
  code: MetaErrorCode;
  message: string;
  field?: string;
}

export interface MetaLoadResult {
  meta: Meta | null;
  errors: MetaError[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isSeverity(v: unknown): v is Severity {
  return v === 'error' || v === 'warning';
}

function parseFieldMeta(v: unknown): FieldMeta | null {
  if (!isObject(v)) return null;
  const out: FieldMeta = {};
  if (v.label !== undefined) {
    if (typeof v.label !== 'string') return null;
    out.label = v.label;
  }
  if (v.group !== undefined) {
    if (typeof v.group !== 'string') return null;
    out.group = v.group;
  }
  if (v.help !== undefined) {
    if (typeof v.help !== 'string') return null;
    out.help = v.help;
  }
  if (v.required !== undefined) {
    if (typeof v.required !== 'boolean') return null;
    out.required = v.required;
  }
  if (v.default !== undefined) {
    if (typeof v.default !== 'string') return null;
    out.default = v.default;
  }
  if (v.emptyText !== undefined) {
    if (typeof v.emptyText !== 'string') return null;
    out.emptyText = v.emptyText;
  }
  return out;
}

function parseGroup(v: unknown): GroupMeta | null {
  if (!isObject(v)) return null;
  if (typeof v.id !== 'string' || typeof v.label !== 'string' || typeof v.order !== 'number') return null;
  return { id: v.id, label: v.label, order: v.order };
}

function parseRule(v: unknown): Rule | null {
  if (!isObject(v)) return null;
  switch (v.type) {
    case 'sum_eq': {
      if (!Array.isArray(v.fields) || !v.fields.every((f) => typeof f === 'string')) return null;
      if (typeof v.total !== 'string' || !isSeverity(v.severity)) return null;
      return { type: 'sum_eq', fields: v.fields, total: v.total, severity: v.severity };
    }
    case 'date_after':
    case 'date_before': {
      if (typeof v.field !== 'string' || typeof v.than !== 'string' || !isSeverity(v.severity)) return null;
      return { type: v.type, field: v.field, than: v.than, severity: v.severity };
    }
    case 'differs': {
      if (typeof v.a !== 'string' || typeof v.b !== 'string' || !isSeverity(v.severity)) return null;
      return { type: 'differs', a: v.a, b: v.b, severity: v.severity };
    }
    case 'required_if': {
      if (typeof v.field !== 'string' || !isObject(v.when) || typeof v.when.field !== 'string') return null;
      const when: { field: string; equals?: string; nonEmpty?: boolean } = { field: v.when.field };
      if (v.when.equals !== undefined) {
        if (typeof v.when.equals !== 'string') return null;
        when.equals = v.when.equals;
      }
      if (v.when.nonEmpty !== undefined) {
        if (typeof v.when.nonEmpty !== 'boolean') return null;
        when.nonEmpty = v.when.nonEmpty;
      }
      return { type: 'required_if', field: v.field, when };
    }
    default:
      return null;
  }
}

/** Parse + structurally validate a template.meta.json payload, and flag META_UNKNOWN_FIELD. */
export function loadTemplateMeta(raw: unknown, usedFieldIds: ReadonlySet<string>): MetaLoadResult {
  if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.title !== 'string' || typeof raw.version !== 'string' || !isObject(raw.fields)) {
    return { meta: null, errors: [{ code: 'META_INVALID_SHAPE', message: 'template.meta.json is missing id/title/version/fields.' }] };
  }

  const fields: Record<string, FieldMeta> = {};
  for (const [key, value] of Object.entries(raw.fields)) {
    const field = parseFieldMeta(value);
    if (field === null) {
      return { meta: null, errors: [{ code: 'META_INVALID_SHAPE', message: `fields.${key} is malformed.`, field: key }] };
    }
    fields[key] = field;
  }

  let groups: GroupMeta[] | undefined;
  if (raw.groups !== undefined) {
    if (!Array.isArray(raw.groups)) {
      return { meta: null, errors: [{ code: 'META_INVALID_SHAPE', message: 'groups must be an array.' }] };
    }
    const parsedGroups: GroupMeta[] = [];
    for (const g of raw.groups) {
      const group = parseGroup(g);
      if (group === null) return { meta: null, errors: [{ code: 'META_INVALID_SHAPE', message: 'a groups[] entry is malformed.' }] };
      parsedGroups.push(group);
    }
    groups = parsedGroups;
  }

  let rules: Rule[] | undefined;
  if (raw.rules !== undefined) {
    if (!Array.isArray(raw.rules)) {
      return { meta: null, errors: [{ code: 'META_INVALID_SHAPE', message: 'rules must be an array.' }] };
    }
    const parsedRules: Rule[] = [];
    for (const r of raw.rules) {
      const rule = parseRule(r);
      if (rule === null) return { meta: null, errors: [{ code: 'META_INVALID_SHAPE', message: 'a rules[] entry is malformed.' }] };
      parsedRules.push(rule);
    }
    rules = parsedRules;
  }

  const meta: Meta = {
    id: raw.id,
    title: raw.title,
    version: raw.version,
    fields,
    ...(groups !== undefined && { groups }),
    ...(rules !== undefined && { rules }),
  };

  const errors: MetaError[] = [];
  for (const key of Object.keys(fields)) {
    if (!usedFieldIds.has(key)) {
      errors.push({ code: 'META_UNKNOWN_FIELD', message: `meta field "${key}" is not used anywhere in the template.`, field: key });
    }
  }

  return { meta, errors };
}
