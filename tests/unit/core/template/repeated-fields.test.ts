import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readDocx, toRawParagraphs } from '../../../../src/core/docx/read';
import { parseTemplate } from '../../../../src/core/tags/parse';
import { collectFieldCounts } from '../../../../src/core/template/fields';

function counts(slug: string): Map<string, number> {
  const bytes = readFileSync(join(__dirname, '../../../../templates', slug, 'template.docx'));
  return collectFieldCounts(parseTemplate(toRawParagraphs(readDocx(bytes))).paragraphs);
}

// One input must fill several places: the party names, amounts and addresses are repeated
// across the summary, the clauses and the signature block of every bundled template.
describe('bundled templates reuse one input in many places', () => {
  const expectations: Record<string, Record<string, number>> = {
    cpcv: { vendedor_nome: 5, comprador_nome: 5, preco_total: 4, imovel_morada: 3 },
    arrendamento: { senhorio_nome: 5, arrendatario_nome: 5, renda_valor: 4, imovel_morada: 3 },
    empreitada: { dono_obra_nome: 4, empreiteiro_nome: 5, preco_total: 4 },
    procuracao: { mandante_nome: 5, mandatario_nome: 5, mandante_nif: 3 },
  };
  for (const [slug, fields] of Object.entries(expectations)) {
    it(`${slug}`, () => {
      const c = counts(slug);
      for (const [id, min] of Object.entries(fields)) {
        expect(c.get(id) ?? 0, `${slug}.${id}`).toBeGreaterThanOrEqual(min);
      }
    });
  }
});
