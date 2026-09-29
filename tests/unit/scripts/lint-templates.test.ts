import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '../../..');

function buildDocx(bodyXml: string): Uint8Array {
  const enc = new TextEncoder();
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}</w:body>
</w:document>`;
  return zipSync(
    { '[Content_Types].xml': enc.encode(contentTypes), '_rels/.rels': enc.encode(rels), 'word/document.xml': enc.encode(doc) },
    { level: 6 },
  );
}

function runLint(cwd: string): { status: number | null; output: string } {
  const scriptPath = join(REPO_ROOT, 'scripts', 'lint-templates.ts');
  const result = spawnSync('npx', ['tsx', scriptPath], { cwd, encoding: 'utf-8', shell: true });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

describe('lint:templates CLI', () => {
  it('exits 0 with no problems for a clean template', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'minutas-lint-ok-'));
    try {
      const dir = join(tmp, 'templates', 'ok');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'template.docx'), buildDocx('<w:p><w:r><w:t>CLÁUSULA {{cl a}}</w:t></w:r></w:p>'));
      writeFileSync(join(dir, 'template.meta.json'), JSON.stringify({ id: 'ok', title: 'Ok', version: '1', fields: {} }));

      const { status, output } = runLint(tmp);
      expect(status).toBe(0);
      expect(output).toContain('1 template(s) OK');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30000);

  it('exits non-zero and reports REF_UNKNOWN for a dangling ref', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'minutas-lint-bad-'));
    try {
      const dir = join(tmp, 'templates', 'broken');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'template.docx'), buildDocx('<w:p><w:r><w:t>Ref: {{ref:nowhere}}</w:t></w:r></w:p>'));
      writeFileSync(join(dir, 'template.meta.json'), JSON.stringify({ id: 'broken', title: 'Broken', version: '1', fields: {} }));

      const { status, output } = runLint(tmp);
      expect(status).not.toBe(0);
      expect(output).toContain('REF_UNKNOWN');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30000);
});
