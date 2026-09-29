import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDocx } from '../../../../src/core/docx/build';
import { readDocx } from '../../../../src/core/docx/read';

const CPCV_DOCX_BYTES = readFileSync(join(__dirname, '../../../../templates/cpcv/template.docx'));
const VALUES = { vendedor_nome: 'Maria Exemplo Silva', preco_total: '235.000,00' };

// SPEC.md §7's p95 < 100 ms (CI gate 150 ms) is an edit->preview budget
// measured against real browser DOM APIs — the authoritative check is the
// Playwright e2e (T4.5), not here. jsdom's DOMParser/XMLSerializer are a JS
// implementation and measurably slower than native browser ones, so this
// unit test only guards against a gross regression (e.g. an accidental O(n²)),
// not the actual SPEC budget.
describe('buildDocx — smoke regression guard (not the SPEC.md §7 gate — see T4.5 e2e)', () => {
  it('does not regress to multi-second build times on the fixture template', () => {
    const samples: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const doc = readDocx(CPCV_DOCX_BYTES);
      const start = performance.now();
      buildDocx({ doc, values: VALUES, disclaimerText: 'Pré-visualização aproximada.' });
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)] as number;
    expect(median).toBeLessThan(1000);
  });
});
