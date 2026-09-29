import { describe, expect, it } from 'vitest';
import { checkGrounding } from '../../../src/llm/grounding';

const SOURCE = 'O NIF do Vendedor  é   252601815 e reside em Lisboa.';

describe('checkGrounding', () => {
  it('treats a null value as an abstention, not a rejection', () => {
    const result = checkGrounding({ value: null, quote: null }, SOURCE, 'text');
    expect(result).toEqual({ abstained: true, grounded: true });
  });

  it('rejects a non-null value with a null quote', () => {
    const result = checkGrounding({ value: '252601815', quote: null }, SOURCE, 'nif');
    expect(result.grounded).toBe(false);
  });

  it('accepts a quote that is a substring after whitespace normalisation', () => {
    // Source has double-spaces; the quote below has single spaces.
    const result = checkGrounding({ value: '252601815', quote: 'NIF do Vendedor é 252601815' }, SOURCE, 'nif');
    expect(result.grounded).toBe(true);
  });

  it('rejects a quote that is not present in the source', () => {
    const result = checkGrounding({ value: '252601815', quote: 'texto que não existe' }, SOURCE, 'nif');
    expect(result.grounded).toBe(false);
  });

  it('rejects when the typed value\'s digits are not a subset of the quote\'s digits (fabrication guard)', () => {
    // Quote is grounded in the source text, but the model changed a digit in `value`.
    const result = checkGrounding({ value: '999999999', quote: 'reside em Lisboa' }, SOURCE, 'nif');
    expect(result.grounded).toBe(false);
  });

  it('does not apply the digit check to plain text fields', () => {
    const result = checkGrounding({ value: 'Lisboa', quote: 'reside em Lisboa' }, SOURCE, 'text');
    expect(result.grounded).toBe(true);
  });
});
