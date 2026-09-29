import { describe, expect, it } from 'vitest';
import { evaluateRule } from '../../../../src/core/template/rules';
import type { Rule } from '../../../../src/core/template/meta';
import type { TagType } from '../../../../src/core/tags/types';

const TODAY = '2026-09-29';

function types(entries: Record<string, TagType>): Map<string, TagType> {
  return new Map(Object.entries(entries));
}

describe('evaluateRule — sum_eq', () => {
  const rule: Rule = { type: 'sum_eq', fields: ['sinal', 'remanescente'], total: 'preco', severity: 'error' };
  const t = types({ sinal: 'eur', remanescente: 'eur', preco: 'eur' });

  it('passes when parts sum to the total', () => {
    const values = { sinal: '100,00', remanescente: '900,00', preco: '1.000,00' };
    expect(evaluateRule(rule, values, t, TODAY).ok).toBe(true);
  });

  it('fails when they do not', () => {
    const values = { sinal: '100,00', remanescente: '800,00', preco: '1.000,00' };
    expect(evaluateRule(rule, values, t, TODAY).ok).toBe(false);
  });

  it('passes (nothing to check yet) when a field is empty', () => {
    const values = { sinal: '', remanescente: '800,00', preco: '1.000,00' };
    expect(evaluateRule(rule, values, t, TODAY).ok).toBe(true);
  });
});

describe('evaluateRule — date_after / date_before', () => {
  const t = types({ escritura: 'data', outra: 'data' });

  it('date_after "today"', () => {
    const rule: Rule = { type: 'date_after', field: 'escritura', than: 'today', severity: 'error' };
    expect(evaluateRule(rule, { escritura: '31/01/2027' }, t, TODAY).ok).toBe(true);
    expect(evaluateRule(rule, { escritura: '01/01/2020' }, t, TODAY).ok).toBe(false);
  });

  it('date_after another field', () => {
    const rule: Rule = { type: 'date_after', field: 'escritura', than: 'outra', severity: 'warning' };
    expect(evaluateRule(rule, { escritura: '02/01/2027', outra: '01/01/2027' }, t, TODAY).ok).toBe(true);
    expect(evaluateRule(rule, { escritura: '01/01/2027', outra: '02/01/2027' }, t, TODAY).ok).toBe(false);
  });

  it('date_before', () => {
    const rule: Rule = { type: 'date_before', field: 'escritura', than: 'today', severity: 'error' };
    expect(evaluateRule(rule, { escritura: '01/01/2020' }, t, TODAY).ok).toBe(true);
    expect(evaluateRule(rule, { escritura: '31/01/2027' }, t, TODAY).ok).toBe(false);
  });
});

describe('evaluateRule — differs', () => {
  const rule: Rule = { type: 'differs', a: 'nifA', b: 'nifB', severity: 'warning' };
  const t = types({});

  it('passes when different', () => {
    expect(evaluateRule(rule, { nifA: '252601815', nifB: '259083011' }, t, TODAY).ok).toBe(true);
  });

  it('fails when equal', () => {
    expect(evaluateRule(rule, { nifA: '252601815', nifB: '252601815' }, t, TODAY).ok).toBe(false);
  });
});

describe('evaluateRule — required_if', () => {
  const t = types({});

  it('nonEmpty condition', () => {
    const rule: Rule = { type: 'required_if', field: 'onus_descricao', when: { field: 'onus', nonEmpty: true } };
    expect(evaluateRule(rule, { onus: 'true', onus_descricao: '' }, t, TODAY).ok).toBe(false);
    expect(evaluateRule(rule, { onus: 'true', onus_descricao: 'hipoteca' }, t, TODAY).ok).toBe(true);
    expect(evaluateRule(rule, { onus: '', onus_descricao: '' }, t, TODAY).ok).toBe(true);
  });

  it('equals condition', () => {
    const rule: Rule = { type: 'required_if', field: 'outro', when: { field: 'tipo', equals: 'x' } };
    expect(evaluateRule(rule, { tipo: 'x', outro: '' }, t, TODAY).ok).toBe(false);
    expect(evaluateRule(rule, { tipo: 'y', outro: '' }, t, TODAY).ok).toBe(true);
  });
});
