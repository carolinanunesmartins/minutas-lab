import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runRoundtrip } from '../../../../src/core/import/evalRoundtrip';

// Importer eval (also `npm run eval:import`): blank every value tag of the shipped
// templates, re-import, and require every occurrence to come back with the same
// type/modifier and the same id grouping.
const STYLES: [string, (label: string) => string][] = [
  ['meta labels', (l) => l],
  ['"inserir …" labels', (l) => `inserir ${l.toLocaleLowerCase('pt-PT')}`],
];

describe('importer round-trip on the shipped templates', () => {
  for (const [styleName, style] of STYLES) {
    for (const slug of ['cpcv', 'arrendamento', 'empreitada', 'procuracao']) {
      it(`${slug} — ${styleName}: 100% of inputs recovered`, () => {
        const dir = join(__dirname, '../../../../templates', slug);
        const meta = JSON.parse(readFileSync(join(dir, 'template.meta.json'), 'utf-8')) as { fields: Record<string, { label?: string }> };
        const report = runRoundtrip(readFileSync(join(dir, 'template.docx')), (id) => style(meta.fields[id]?.label ?? id));
        expect(report.lintProblems).toEqual([]);
        expect(report.misses.map((m) => `${m.expected.id}: ${m.reason}`)).toEqual([]);
        expect(report.correct).toBe(report.total);
      });
    }
  }
});
