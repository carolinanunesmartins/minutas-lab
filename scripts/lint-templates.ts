import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

// readDocx (src/core/docx/read.ts) uses the browser DOMParser/XMLSerializer
// globals; polyfill them here so this Node-side CLI can call it too (jsdom is
// already a devDependency for vitest's test environment — no new dependency).
const jsdomWindow = new JSDOM().window;
globalThis.DOMParser = jsdomWindow.DOMParser;
globalThis.XMLSerializer = jsdomWindow.XMLSerializer;

const { readDocx, toRawParagraphs } = await import('../src/core/docx/read');
const { DocxInputError } = await import('../src/core/docx/zip');
const { parseTemplate } = await import('../src/core/tags/parse');
const { collectUsedFieldIds } = await import('../src/core/template/fields');
const { loadTemplateMeta } = await import('../src/core/template/meta');
const { analyzeBlocks, findHiddenRefs } = await import('../src/core/numbering/blocks');

const TEMPLATES_DIR = join(process.cwd(), 'templates');

interface LintProblem {
  slug: string;
  code: string;
  message: string;
}

function lintTemplate(slug: string): LintProblem[] {
  const dir = join(TEMPLATES_DIR, slug);
  const problems: LintProblem[] = [];

  const docxPath = join(dir, 'template.docx');
  const metaPath = join(dir, 'template.meta.json');

  if (!existsSync(docxPath)) return [{ slug, code: 'MISSING_FILE', message: 'template.docx not found.' }];
  if (!existsSync(metaPath)) return [{ slug, code: 'MISSING_FILE', message: 'template.meta.json not found.' }];

  let paragraphs;
  let tagErrors;
  try {
    const doc = readDocx(readFileSync(docxPath));
    const parsed = parseTemplate(toRawParagraphs(doc));
    paragraphs = parsed.paragraphs;
    tagErrors = parsed.errors;
  } catch (e) {
    const code = e instanceof DocxInputError ? e.code : 'DOCX_READ_ERROR';
    return [{ slug, code, message: e instanceof Error ? e.message : String(e) }];
  }

  for (const err of tagErrors) {
    problems.push({ slug, code: err.code, message: err.message });
  }
  for (const err of findHiddenRefs(analyzeBlocks(paragraphs))) {
    problems.push({ slug, code: err.code, message: err.message });
  }

  let metaRaw: unknown;
  try {
    metaRaw = JSON.parse(readFileSync(metaPath, 'utf-8'));
  } catch (e) {
    return [...problems, { slug, code: 'META_INVALID_JSON', message: e instanceof Error ? e.message : String(e) }];
  }
  const used = collectUsedFieldIds(paragraphs);
  const { errors: metaErrors } = loadTemplateMeta(metaRaw, used);
  for (const err of metaErrors) {
    problems.push({ slug, code: err.code, message: err.message });
  }

  return problems;
}

function main(): void {
  if (!existsSync(TEMPLATES_DIR)) {
    console.log('lint:templates — no templates/ directory yet, nothing to validate.');
    return;
  }

  const slugs = readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  if (slugs.length === 0) {
    console.log('lint:templates — templates/ is empty, nothing to validate.');
    return;
  }

  const allProblems = slugs.flatMap(lintTemplate);

  if (allProblems.length === 0) {
    console.log(`lint:templates — ${slugs.length} template(s) OK.`);
    return;
  }

  for (const p of allProblems) {
    console.error(`[${p.slug}] ${p.code}: ${p.message}`);
  }
  console.error(`lint:templates — ${allProblems.length} problem(s) across ${slugs.length} template(s).`);
  process.exit(1);
}

main();
