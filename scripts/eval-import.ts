import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

// Same Node-side DOM polyfill as lint-templates.ts.
const jsdomWindow = new JSDOM().window;
globalThis.DOMParser = jsdomWindow.DOMParser;
globalThis.XMLSerializer = jsdomWindow.XMLSerializer;

const { runRoundtrip } = await import('../src/core/import/evalRoundtrip');

const TEMPLATES_DIR = join(process.cwd(), 'templates');
const verbose = process.argv.includes('--verbose');

// Two label styles: the template's own labels, and a looser human style ("inserir …", lower-case).
const STYLES: { name: string; label: (l: string) => string }[] = [
  { name: 'meta', label: (l) => l },
  { name: 'inserir', label: (l) => `inserir ${l.toLocaleLowerCase('pt-PT')}` },
];

let total = 0;
let correct = 0;
for (const style of STYLES) for (const slug of readdirSync(TEMPLATES_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
  const dir = join(TEMPLATES_DIR, slug);
  const meta = JSON.parse(readFileSync(join(dir, 'template.meta.json'), 'utf-8')) as { fields: Record<string, { label?: string }> };
  const report = runRoundtrip(readFileSync(join(dir, 'template.docx')), (id) => style.label(meta.fields[id]?.label ?? id));
  total += report.total;
  correct += report.correct;
  console.log(`[${style.name}/${slug}] ${report.correct}/${report.total} occurrences recovered (${report.fields.length} fields)`);
  for (const p of report.lintProblems) console.log(`  LINT ${p}`);
  for (const m of report.misses) console.log(`  MISS ${m.expected.id}:${m.expected.type} — ${m.reason}`);
  if (verbose) for (const f of report.fields) console.log(`  field ${f.id} (${f.type}) [${f.group}] "${f.label}"`);
}
const pct = total === 0 ? 0 : (100 * correct) / total;
console.log(`eval:import — ${correct}/${total} (${pct.toFixed(1)}%)`);
if (correct !== total) process.exit(1);
