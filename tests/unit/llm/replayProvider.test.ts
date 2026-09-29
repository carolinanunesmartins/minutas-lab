import { describe, expect, it } from 'vitest';
import { ReplayProvider, canonicalRequestJson, sha256Hex } from '../../../src/llm/replayProvider';
import { LlmProviderError } from '../../../src/llm/types';
import type { ExtractRequest } from '../../../src/llm/types';

const REQUEST: ExtractRequest = {
  templateId: 'cpcv',
  fields: [{ id: 'vendedor_nome', label: 'Nome', type: 'text' }],
  text: 'Maria Exemplo Silva.',
};

describe('canonicalRequestJson', () => {
  it('is stable regardless of key insertion order', () => {
    const a = canonicalRequestJson(REQUEST);
    const reordered: ExtractRequest = { text: REQUEST.text, templateId: REQUEST.templateId, fields: REQUEST.fields };
    const b = canonicalRequestJson(reordered);
    expect(a).toBe(b);
  });
});

describe('ReplayProvider', () => {
  it('returns the fixture matching the request hash', async () => {
    const hash = await sha256Hex(canonicalRequestJson(REQUEST));
    const provider = new ReplayProvider({ [hash]: '{"fields":{}}' });
    expect(await provider.complete(REQUEST)).toBe('{"fields":{}}');
  });

  it('throws NO_FIXTURE for an unrecorded request', async () => {
    const provider = new ReplayProvider({});
    await expect(provider.complete(REQUEST)).rejects.toMatchObject({ code: 'NO_FIXTURE' } satisfies Partial<LlmProviderError>);
  });

  it('a different request text hashes differently', async () => {
    const hashA = await sha256Hex(canonicalRequestJson(REQUEST));
    const hashB = await sha256Hex(canonicalRequestJson({ ...REQUEST, text: 'texto diferente' }));
    expect(hashA).not.toBe(hashB);
  });
});
