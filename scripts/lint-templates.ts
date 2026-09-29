import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TEMPLATES_DIR = join(process.cwd(), 'templates');

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

  // REQ-TAG / REQ-REPO: full tag-grammar and meta validation lands in M3 (T3.1).
  console.log(`lint:templates — found ${slugs.length} template(s); validation rules land in M3.`);
}

main();
