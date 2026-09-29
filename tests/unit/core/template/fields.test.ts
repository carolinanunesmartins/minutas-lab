import { describe, expect, it } from 'vitest';
import { humanizeFieldId } from '../../../../src/core/template/fields';

describe('humanizeFieldId', () => {
  it('replaces underscores with spaces and capitalises the first letter', () => {
    expect(humanizeFieldId('vendedor_nome')).toBe('Vendedor nome');
    expect(humanizeFieldId('preco_total')).toBe('Preco total');
    expect(humanizeFieldId('onus')).toBe('Onus');
  });
});
