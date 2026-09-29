import { describe, expect, it } from 'vitest';
import { runExtraction } from '../../../src/llm/extract';
import { LlmProviderError } from '../../../src/llm/types';
import type { ExtractRequest, LlmProvider } from '../../../src/llm/types';

const REQUEST: ExtractRequest = {
  templateId: 'cpcv',
  fields: [
    { id: 'vendedor_nome', label: 'Nome do vendedor', type: 'text' },
    { id: 'vendedor_nif', label: 'NIF do vendedor', type: 'nif' },
  ],
  text: 'Maria Exemplo Silva, contribuinte fiscal 252601815, reside em Lisboa.',
};

function providerReturning(raw: string): LlmProvider {
  return { complete: () => Promise.resolve(raw) };
}

describe('runExtraction', () => {
  it('accepts grounded proposals', async () => {
    const raw = JSON.stringify({
      fields: {
        vendedor_nome: { value: 'Maria Exemplo Silva', quote: 'Maria Exemplo Silva' },
        vendedor_nif: { value: '252601815', quote: 'contribuinte fiscal 252601815' },
      },
    });
    const result = await runExtraction(providerReturning(raw), REQUEST);
    expect(result.rejectedCount).toBe(0);
    expect(result.fields).toEqual([
      { id: 'vendedor_nome', value: 'Maria Exemplo Silva', quote: 'Maria Exemplo Silva', grounded: true },
      { id: 'vendedor_nif', value: '252601815', quote: 'contribuinte fiscal 252601815', grounded: true },
    ]);
  });

  it('rejects an ungrounded proposal and nulls it out, counting the rejection', async () => {
    const raw = JSON.stringify({
      fields: {
        vendedor_nome: { value: 'Maria Exemplo Silva', quote: 'Maria Exemplo Silva' },
        vendedor_nif: { value: '999999999', quote: 'texto inventado' },
      },
    });
    const result = await runExtraction(providerReturning(raw), REQUEST);
    expect(result.rejectedCount).toBe(1);
    const nif = result.fields.find((f) => f.id === 'vendedor_nif');
    expect(nif).toEqual({ id: 'vendedor_nif', value: null, quote: null, grounded: false });
  });

  it('treats a missing field in the response as an abstention', async () => {
    const raw = JSON.stringify({ fields: { vendedor_nome: { value: null, quote: null } } });
    const result = await runExtraction(providerReturning(raw), REQUEST);
    expect(result.fields.find((f) => f.id === 'vendedor_nif')).toEqual({
      id: 'vendedor_nif',
      value: null,
      quote: null,
      grounded: true,
    });
  });

  it('strips a ```json code fence before parsing', async () => {
    const raw = '```json\n{"fields": {"vendedor_nome": {"value": "Maria Exemplo Silva", "quote": "Maria Exemplo Silva"}}}\n```';
    const result = await runExtraction(providerReturning(raw), REQUEST);
    expect(result.fields.find((f) => f.id === 'vendedor_nome')?.value).toBe('Maria Exemplo Silva');
  });

  it('throws INVALID_JSON on unparseable output', async () => {
    await expect(runExtraction(providerReturning('not json'), REQUEST)).rejects.toMatchObject({ code: 'INVALID_JSON' });
  });

  it('throws SCHEMA_INVALID when the shape does not match', async () => {
    const raw = JSON.stringify({ nope: true });
    await expect(runExtraction(providerReturning(raw), REQUEST)).rejects.toMatchObject({ code: 'SCHEMA_INVALID' });
  });

  it('rejects a request with text over the 20,000-char limit before calling the provider', async () => {
    const longRequest: ExtractRequest = { ...REQUEST, text: 'a'.repeat(20_001) };
    let called = false;
    const provider: LlmProvider = {
      complete: () => {
        called = true;
        return Promise.resolve('{}');
      },
    };
    await expect(runExtraction(provider, longRequest)).rejects.toBeInstanceOf(LlmProviderError);
    expect(called).toBe(false);
  });
});
