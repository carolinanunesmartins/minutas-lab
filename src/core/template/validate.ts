import { isValidCcFormat } from '../validators/cc';
import { isValidIbanPt } from '../validators/iban';
import { isValidNif, isValidNipc } from '../validators/nif-nipc';
import { isValidDatePt } from '../formats/date';
import { isValidEurPt } from '../formats/eur';
import { isValidIntPt } from '../formats/int';
import type { TagError, TagType } from '../tags/types';
import { analyzeBlocks, findHiddenRefs } from '../numbering/blocks';
import type { ClassifiedParagraph } from '../tags/types';
import { evaluateRule } from './rules';
import type { Meta, Severity } from './meta';

// REQ-VAL layers (SPEC.md §6): (1) format/checksum, (2) conditional required,
// (3) cross-field rules, (4) structural.

const FORMAT_VALIDATORS: Partial<Record<TagType, (v: string) => boolean>> = {
  nif: isValidNif,
  nipc: isValidNipc,
  iban: isValidIbanPt,
  data: isValidDatePt,
  eur: isValidEurPt,
  int: isValidIntPt,
  cc: isValidCcFormat,
};

// CC has no verified checksum (src/core/validators/cc.ts) — never block on it.
const EXPERIMENTAL_TYPES: ReadonlySet<TagType> = new Set(['cc']);

export type FieldIssueCode = 'FORMAT_INVALID' | 'REQUIRED' | 'REQUIRED_IF';

export interface FieldIssue {
  field: string;
  code: FieldIssueCode;
  severity: Severity;
}

export interface RuleIssue {
  ruleType: string;
  severity: Severity;
  fields: string[];
}

export interface ValidationResult {
  fieldIssues: FieldIssue[];
  ruleIssues: RuleIssue[];
  structuralErrors: TagError[];
  hasBlockingError: boolean;
}

function ruleFields(rule: Parameters<typeof evaluateRule>[0]): string[] {
  switch (rule.type) {
    case 'sum_eq':
      return [...rule.fields, rule.total];
    case 'date_after':
    case 'date_before':
      return [rule.field, rule.than];
    case 'differs':
      return [rule.a, rule.b];
    case 'required_if':
      return [rule.field, rule.when.field];
  }
}

export interface ValidateTemplateValuesInput {
  paragraphs: ClassifiedParagraph[];
  meta: Meta;
  fieldTypes: ReadonlyMap<string, TagType>;
  values: Readonly<Record<string, string>>;
  todayIso: string;
  /** Errors from `parseTemplate(...).errors` — layer 4's dangling-ref/duplicate-anchor half. */
  tagErrors: readonly TagError[];
}

export function validateTemplateValues(input: ValidateTemplateValuesInput): ValidationResult {
  const { paragraphs, meta, fieldTypes, values, todayIso, tagErrors } = input;

  // Layer 1: format/checksum.
  const fieldIssues: FieldIssue[] = [];
  for (const [field, type] of fieldTypes) {
    const raw = values[field];
    if (!raw) continue;
    const validator = FORMAT_VALIDATORS[type];
    if (!validator) continue;
    if (!validator(raw)) {
      fieldIssues.push({ field, code: 'FORMAT_INVALID', severity: EXPERIMENTAL_TYPES.has(type) ? 'warning' : 'error' });
    }
  }

  // Layer 2: unconditional `required` + `required_if` rules. Block/condition
  // ids (boolean toggles, e.g. `{{#se arrendado}}`) are never in `fieldTypes`
  // (that only tracks value tags) — an empty string is a legitimate "false"
  // for those, not a missing answer, so `required` doesn't apply to them.
  for (const [field, fieldMeta] of Object.entries(meta.fields)) {
    if (fieldMeta.required && fieldTypes.has(field) && !values[field]) {
      fieldIssues.push({ field, code: 'REQUIRED', severity: 'error' });
    }
  }

  // Layer 3 (+ required_if, folded into layer 2's fieldIssues).
  const ruleIssues: RuleIssue[] = [];
  for (const rule of meta.rules ?? []) {
    const evaluation = evaluateRule(rule, values, fieldTypes, todayIso);
    if (evaluation.ok) continue;
    if (rule.type === 'required_if') {
      fieldIssues.push({ field: rule.field, code: 'REQUIRED_IF', severity: 'error' });
    } else {
      ruleIssues.push({ ruleType: rule.type, severity: evaluation.severity, fields: ruleFields(rule) });
    }
  }

  // Layer 4: structural (dangling refs / duplicate anchors from M1 + hidden-ref from T3.3).
  const structuralErrors: TagError[] = [...tagErrors, ...findHiddenRefs(analyzeBlocks(paragraphs))];

  const hasBlockingError =
    structuralErrors.length > 0 ||
    fieldIssues.some((i) => i.severity === 'error') ||
    ruleIssues.some((i) => i.severity === 'error');

  return { fieldIssues, ruleIssues, structuralErrors, hasBlockingError };
}
