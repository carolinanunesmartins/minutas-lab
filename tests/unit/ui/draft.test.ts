import { describe, expect, it } from 'vitest';
import { parseDraft, serializeDraft } from '../../../src/ui/draft';

const KNOWN = new Set(['vendedor_nome', 'preco_total']);

describe('draft JSON', () => {
  it('round-trips values, dropping empty ones', () => {
    const text = serializeDraft('cpcv', '0.1.0', { vendedor_nome: 'Maria', preco_total: '' });
    expect(parseDraft(text, 'cpcv', KNOWN)).toEqual({ ok: true, values: { vendedor_nome: 'Maria' }, ignored: 0 });
  });

  it('ignores unknown field ids and reports how many', () => {
    const text = JSON.stringify({ app: 'minutas-lab', templateId: 'cpcv', values: { vendedor_nome: 'A', __proto__x: 'b', extra: 'c' } });
    expect(parseDraft(text, 'cpcv', KNOWN)).toEqual({ ok: true, values: { vendedor_nome: 'A' }, ignored: 2 });
  });

  it('rejects other templates, bad shapes, non-JSON and oversized files', () => {
    const other = serializeDraft('arrendamento', '0.1.0', { vendedor_nome: 'A' });
    expect(parseDraft(other, 'cpcv', KNOWN)).toEqual({ ok: false, error: 'other-template' });
    expect(parseDraft('{"values": 3}', 'cpcv', KNOWN)).toEqual({ ok: false, error: 'bad-shape' });
    expect(parseDraft('nope', 'cpcv', KNOWN)).toEqual({ ok: false, error: 'not-json' });
    expect(parseDraft('x'.repeat(600 * 1024), 'cpcv', KNOWN)).toEqual({ ok: false, error: 'too-large' });
    const nonString = JSON.stringify({ app: 'minutas-lab', templateId: 'cpcv', values: { vendedor_nome: 5 } });
    expect(parseDraft(nonString, 'cpcv', KNOWN)).toEqual({ ok: false, error: 'bad-shape' });
  });
});
