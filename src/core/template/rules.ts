import { compareIsoDates, parseDatePt } from '../formats/date';
import { parseEurPt } from '../formats/eur';
import { parseIntPt } from '../formats/int';
import type { TagType } from '../tags/types';
import type { Rule } from './meta';

export interface RuleEvaluation {
  rule: Rule;
  /** true if satisfied, or if any referenced field is empty/unparseable (nothing to check yet). */
  ok: boolean;
  severity: 'error' | 'warning';
}

function numericValue(fieldId: string, values: Readonly<Record<string, string>>, types: ReadonlyMap<string, TagType>): number | null {
  const raw = values[fieldId];
  if (raw === undefined || raw === '') return null;
  const type = types.get(fieldId);
  if (type === 'eur') return parseEurPt(raw);
  if (type === 'int') return parseIntPt(raw);
  return null;
}

function isoValue(
  fieldOrKeyword: string,
  values: Readonly<Record<string, string>>,
  types: ReadonlyMap<string, TagType>,
  todayIso: string,
): string | null {
  if (fieldOrKeyword === 'today') return todayIso;
  const raw = values[fieldOrKeyword];
  if (raw === undefined || raw === '') return null;
  if (types.get(fieldOrKeyword) !== 'data') return null;
  return parseDatePt(raw);
}

export function evaluateRule(
  rule: Rule,
  values: Readonly<Record<string, string>>,
  types: ReadonlyMap<string, TagType>,
  todayIso: string,
): RuleEvaluation {
  switch (rule.type) {
    case 'sum_eq': {
      const parts = rule.fields.map((f) => numericValue(f, values, types));
      const total = numericValue(rule.total, values, types);
      const allKnown = total !== null && parts.every((p) => p !== null);
      const ok = !allKnown || parts.reduce<number>((sum, p) => sum + (p ?? 0), 0) === total;
      return { rule, ok, severity: rule.severity };
    }
    case 'date_after':
    case 'date_before': {
      const fieldIso = isoValue(rule.field, values, types, todayIso);
      const thanIso = isoValue(rule.than, values, types, todayIso);
      const ok =
        fieldIso === null ||
        thanIso === null ||
        (rule.type === 'date_after' ? compareIsoDates(fieldIso, thanIso) > 0 : compareIsoDates(fieldIso, thanIso) < 0);
      return { rule, ok, severity: rule.severity };
    }
    case 'differs': {
      const a = values[rule.a];
      const b = values[rule.b];
      const ok = !a || !b || a !== b;
      return { rule, ok, severity: rule.severity };
    }
    case 'required_if': {
      const condition = values[rule.when.field];
      const conditionMet =
        rule.when.equals !== undefined ? condition === rule.when.equals : rule.when.nonEmpty === true ? Boolean(condition) : false;
      const ok = !conditionMet || Boolean(values[rule.field]);
      return { rule, ok, severity: 'error' };
    }
  }
}

export function evaluateRules(
  rules: readonly Rule[],
  values: Readonly<Record<string, string>>,
  types: ReadonlyMap<string, TagType>,
  todayIso: string,
): RuleEvaluation[] {
  return rules.map((rule) => evaluateRule(rule, values, types, todayIso));
}
