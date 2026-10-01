# minutas-lab

Fill in Portuguese legal contract templates in your browser. Pick a template, complete a validated form, watch a Word-like preview update as you type, and download the finished `.docx`. You can also turn your own minuta with blanks (`[Nome do Vendedor]`, `__/__/____`) into a new template.

Everything runs locally in the browser. There is no backend, no database, no analytics and no account.

**Live demo:** <https://carolinanunesmartins.github.io/minutas-lab/>

> **This is an MVP / hobby project.** The templates are drafts and nothing here is legal advice. Read the [legal disclaimer](#legal-disclaimer) before using any generated document.

---

## Get started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer (the repo pins `20` in `.nvmrc`)
- npm (bundled with Node.js)
- Git

### Install

```bash
git clone https://github.com/carolinanunesmartins/minutas-lab.git
cd minutas-lab
npm ci
```

`npm ci` installs exactly what is in `package-lock.json`.

### Run locally

```bash
npm run dev
```

Open the URL Vite prints (by default <http://localhost:5173>). Pick a template and start filling it in.

### Production build

```bash
npm run build      # type-check + bundle into dist/
npm run preview    # serve dist/ locally (default http://localhost:4173)
```

The build is a static site (`base: './'`), so `dist/` can be hosted on any static host, including GitHub Pages.

### Run the checks

```bash
npm run verify     # typecheck + lint + unit tests + template lint + build
npm run eval:import   # importer round-trip on the bundled templates (must be 100%)

npx playwright install chromium   # once
npm run test:e2e   # end-to-end + accessibility (axe)
```

---

## Features

**Fill in a contract**
- Four ready-made templates (original drafts, see [Templates](#templates)).
- Form generated from the template: grouped fields, dropdowns for closed choices, native date inputs, typed inputs for amounts, tax numbers and day counts.
- Validation as you go: format and checksum checks (NIF/NIPC, IBAN PT, dates, euro amounts), conditional required fields and cross-field rules (for example deposit + remainder = price, dates in the right order). Errors are explained in Portuguese, with the fix.
- Live preview that updates after each edit, with filled and empty fields highlighted. Click a field in the preview to jump to its input, or focus an input to scroll the preview to it. Optional clauses can be switched on and off.
- Amounts and numbers can be written out in words ("por extenso") automatically; clauses and cross-references are numbered automatically.

**Download and keep your data**
- Final download (blocked while there are validation errors, with a review screen) or draft download (always available, empty fields highlighted and marked "RASCUNHO"). The preview and the download come from the same document.
- Save the form data to a JSON file and load it back later. Nothing is stored in the browser between visits.

**Create your own template**
- Upload a `.docx` with blanks and the app finds them, proposes a field for each one (name, type, group, options), lets you review and edit everything, and generates a tagged template that you can use immediately or download (`.docx` + `.json`).
- Blanks it understands: `[text in brackets]` (the text becomes the field label), `__/__/____` (a date), `____` and `....`. `[escolher uma: …]` instruction brackets are skipped.
- Works offline and deterministically (no AI, no API key). It warns you when a document looks already filled in (valid-looking NIF, IBAN or email), because it is meant for blank minutas only.
- Uploaded files are size-limited and sanitised before use (see [Privacy and security](#privacy-and-security)).

**Quality**
- Accessible interface (keyboard navigation, labelled inputs, error summary), responsive layout, Portuguese (pt-PT) user interface.
- Unit, property-based and end-to-end tests; a round-trip evaluation proves the importer can rebuild all inputs of the bundled templates.

---

## Templates

| Template | Slug |
|---|---|
| Contrato-promessa de compra e venda de imóvel (CPCV) | `cpcv` |
| Contrato de arrendamento urbano para habitação | `arrendamento` |
| Contrato de empreitada | `empreitada` |
| Procuração | `procuracao` |

Each lives in `templates/<slug>/` as `template.docx` (the text with `{{tags}}`) plus `template.meta.json` (labels, groups, options, rules). The tag syntax and how to add a template are documented in [`docs/templates.md`](./docs/templates.md).

---

## Privacy and security

- **Client-side only.** Documents, form values and uploaded files never leave your browser. The app makes no third-party network requests (the Content Security Policy only allows its own origin).
- **No persistence.** Values are kept in memory only; the browser warns before you leave with unsaved data.
- **Hostile files.** Uploads are size-bounded; archives with macros, path traversal or external relationships are rejected or stripped; inserted values are XML-escaped; links in the preview are restricted to `http(s)` and `mailto`.
- Do not upload documents that contain real personal data to the template importer. Use blank minutas.

To report a vulnerability see [`SECURITY.md`](./SECURITY.md).

---

## Legal disclaimer

- **Not legal advice.** The application and the templates do not provide legal, tax or notarial advice and do not create a lawyer–client relationship. Have a qualified professional review any document before you sign or rely on it.
- **Templates are drafts.** They are original, synthetic drafts that have **not** been reviewed by a lawyer. Each template's source lists points a jurist should confirm (`=== PONTOS A VALIDAR POR JURISTA ===`). Laws and formal requirements (for example signature recognition, certificates, registrations, deeds) change and depend on the case.
- **No validity claims.** "Format valid" ("formato válido") means a value passes a syntax or checksum test, nothing more. It does not mean the number exists, belongs to the person, or is legally valid.
- **Approximate preview.** The preview approximates the final document. The downloaded `.docx` is authoritative, and you should open and check it in a word processor.
- **Your responsibility.** You are responsible for the data you enter and for how you use the generated documents, including compliance with data protection law (GDPR/RGPD) for any personal data you handle.
- **No warranty.** The software is provided "as is" under the MIT licence, without warranty of any kind. The authors are not liable for any loss arising from its use.
- **No affiliation.** This is an independent project, not affiliated with or endorsed by any law firm, notary, registry or public authority. Templates contain no third-party material.

---

## Tech stack

React 18 · TypeScript (strict) · Vite · Tailwind CSS · `docx-preview` (rendering) · `fflate` (zip) · `zod` · Vitest + fast-check · Playwright + axe-core.

## Project layout

```
src/core/       pure TypeScript: tag parser, numbering, validators, extenso, DOCX read/write, template importer
src/workers/    Web Worker that builds the DOCX for the preview
src/ui/         React components; all user-facing strings in messages.pt.ts
templates/      the bundled templates (template.docx + template.meta.json)
fixtures/       synthetic .docx files used by tests
tests/          unit, property and end-to-end tests
docs/           architecture, template authoring guide, architecture decision records
scripts/        template linting, fixture generation, importer evaluation, repo policy check
```

See [`docs/architecture.md`](./docs/architecture.md) for the module map and [`SPEC.md`](./SPEC.md) for the detailed requirements.

## Commands

| Command | Purpose |
|---|---|
| `npm ci` | install from the lockfile |
| `npm run dev` | development server |
| `npm run build` / `npm run preview` | production build / serve it locally |
| `npm run verify` | typecheck + lint + unit tests + template lint + build |
| `npm run test` / `test:cov` / `test:e2e` | unit tests / with coverage / Playwright + axe |
| `npm run lint:templates` | validate every bundled template and its metadata |
| `npm run eval:import` | importer round-trip evaluation (must be 100%) |
| `npm run check:policy` | repository policy guard (no stray `.docx`, no secrets) |

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). The project was built with substantial AI-agent assistance under human review; [`AGENTS.md`](./AGENTS.md) describes the rules every change follows.

## Licence

MIT, see [`LICENSE`](./LICENSE).
