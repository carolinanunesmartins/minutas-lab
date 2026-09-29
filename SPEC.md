# SPEC.md — minutas-lab

Normative. MUST/SHOULD per RFC 2119. IDs are referenced from ROADMAP and tests (`// REQ-VAL-03`).

## 1. Glossary (pt-PT)
minuta = contract template · cláusula (cl) · ponto/número (pt) · alínea (al) · extenso = amount/number written in words · NIF/NIPC = tax IDs · CC = Cartão de Cidadão · CPCV = contrato-promessa de compra e venda · sinal = deposit · escritura = deed.

## 2. Requirements index
REQ-TAG (§3) · REQ-NUM (§4) · REQ-VAL (§5–6) · REQ-PRV (§8) · REQ-DL (§8) · REQ-LLM (§10) · REQ-SEC (§9) · REQ-UI (§7) · REQ-EVAL (§11) · REQ-REPO (§12).

## 3. Tag grammar (REQ-TAG)
```
{{ id[:type][|modifier] }}        value
{{#id}} … {{/id}}                 repeat/optional block (shown if id non-empty/true)
{{#se id}} … {{#senao}} … {{/se}} conditional
{{cl id?}} {{pt id?}} {{al id?}}  computed numbering markers (optional anchor id)
{{ref:id}}                        cross-reference to an anchor
\{{                               literal "{{"
```
- `id`: `[a-z][a-z0-9_]*`; prefix before first `_` is the default UI group.
- types: `text` (default) `nif nipc iban cc data eur int`. Modifiers: `extenso`, `upper`.
- Block tags MUST be alone in their paragraph (removed with the paragraph).
- Allowed in body paragraphs incl. table cells; NOT in headers/footers.
- A tag may be split across runs; engine builds a run-map per paragraph, replaces the char span, keeps first run's `rPr`.
- Same id with different types → `TAG_TYPE_CONFLICT`.

Error codes (all fail `lint:templates`): `TAG_SYNTAX TAG_UNKNOWN_TYPE TAG_TYPE_CONFLICT TAG_BLOCK_UNCLOSED TAG_BLOCK_MISMATCH TAG_BLOCK_NOT_ALONE TAG_MODIFIER_INVALID REF_UNKNOWN ANCHOR_DUPLICATE REF_TARGET_HIDDEN META_UNKNOWN_FIELD TAG_UNSUPPORTED_LOCATION`.

## 4. Numbering (REQ-NUM)
- `{{cl}}` renders ordinal in caps ("PRIMEIRA", "SEGUNDA"… "DÉCIMA SEXTA", "VIGÉSIMA"); counters computed after blocks are resolved (hidden blocks don't consume numbers).
- `{{pt}}` = n.º within current clause (resets per `cl`); `{{al}}` = a), b)… within current pt.
- `{{ref:id}}` → "n.º 4 da Cláusula Primeira"; omit clause part when target is in the same clause.
- Reference to a hidden anchor → `REF_TARGET_HIDDEN` (error at lint if unconditional; validation error at runtime).

## 5. Template package & rules
```ts
type Meta = {
  id: string; title: string; version: string;
  fields: Record<string,{label?:string; group?:string; help?:string; required?:boolean; default?:string; emptyText?:string}>;
  groups?: {id:string; label:string; order:number}[];
  rules?: Rule[];
};
type Rule =
 | {type:'sum_eq'; fields:string[]; total:string; severity:'error'|'warning'}
 | {type:'date_after'|'date_before'; field:string; than:string|'today'; severity:...}
 | {type:'differs'; a:string; b:string; severity:...}
 | {type:'required_if'; field:string; when:{field:string; equals?:string; nonEmpty?:boolean}};
```
Fields absent from meta get humanised labels. Unknown field in meta → `META_UNKNOWN_FIELD`.

## 6. Validation (REQ-VAL) — pure functions in `src/core`
Layers: (1) format/checksum, (2) conditional required, (3) cross-field rules, (4) structural (dangling refs, duplicate anchors). Severity `error` blocks final download; `warning` doesn't.
- **NIF/NIPC**: 9 digits; weights 9..2 over first 8; c = 11 − (sum mod 11); c ≥ 10 → 0. UI text "formato válido". NIF prefix list unverified → do not enforce.
- **IBAN PT**: 25 chars `PT50…`, mod 97 = 1.
- **CC**: 12-char format + Luhn-like checksum; EXPERIMENTAL, warning-only until verified.
- **Data**: input `dd/mm/aaaa`, stored ISO; real calendar dates only.
- **eur**: input pt-PT (`1.234,56`), stored integer cents, output `1.234,56 €` with NBSP.
- **Extenso** (pt-PT): groups milhões/mil/unidades; "e" before the lower part iff it is a single non-zero group with value <100 or a multiple of 100; "cem" (exact) vs "cento e"; "mil" never "um mil"; "um milhão"/"milhões"; euros + "e X cêntimos". Multi-group remainder edge cases: flag for native review.
- **Cross-field defaults** (CPCV-like): sinal + remanescente = preço (error); escritura date after today (error); CC validity after escritura (warning); buyer ≠ seller NIF/IBAN (warning).

Test vectors (synthetic; may coincide with real IDs — fixtures only):
- NIF valid: `252601815`, `259083011`; invalid: `296030822`.
- NIPC valid: `566131862`, `509139094`.
- IBAN valid: `PT50999946281948219935123`, `PT50999981909378657975468`; invalid: `PT50999946281948219935124`.
- Extenso (value → text): 0 zero · 21 vinte e um · 100 cem · 101 cento e um · 1000 mil · 1001 mil e um · 1100 mil e cem · 1101 mil cento e um · 2000 dois mil · 100000 cem mil · 1000000 um milhão · 2000000 dois milhões · 1000001 um milhão e um. Full 25-vector file generated in M2 from a reference implementation and reviewed by a native speaker (HUMAN).

## 7. UI (REQ-UI)
- Two panes ≥1024 px (form | preview); tabs below. States: empty, loading, error, ready. No router; Vite `base './'`.
- Preview shading: filled soft, active strong, empty shown as yellow label. Label "Pré-visualização aproximada".
- Preview pipeline: values → Web Worker builds DOCX → `docx-preview` into offscreen container → swap buffers keeping scroll. Debounce 50–100 ms. `ignoreLastRenderedPageBreak:false`; templates saved once in Word. Footer "Página i de N" fixed by post-processing.
- Latency: p95 < 100 ms target, CI gate < 150 ms (fixture template).
- Accessibility: keyboard nav, labels, error association, axe with zero serious violations.
- All strings in `src/ui/messages.pt.ts`.

## 8. Download & persistence (REQ-DL, REQ-PRV)
- Single source of truth: same DOCX bytes for preview and download.
- "Descarregar minuta": only with zero errors. "Descarregar rascunho": always; empty fields highlighted yellow + "RASCUNHO" note. Review screen before final.
- Disclaimer appended as final body paragraph.
- No persistence of values (`beforeunload` warning). `localStorage` only for UI prefs.

## 9. Security (REQ-SEC)
- Input guard defaults (calibrate later, record in ADR-0007): file ≤ 5 MiB; ≤ 200 entries; total uncompressed ≤ 25 MiB; per-entry ≤ 15 MiB; bounded inflation (JSZip alone is insufficient: measured 41 KB → 40 MiB in ~0.9 s); reject encrypted, `vbaProject`, path traversal.
- Sanitise relationships: keep `http/https/mailto` only; strip external relationships. (Spike: `javascript:` hyperlink rendered active.)
- Wrap parse/render in try/catch → clear pt-PT error.
- CSP meta: `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src <LLM origin>; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'`. Limits: no `frame-ancestors`/HSTS via meta.
- Repo: see AGENTS §4 + §12.

## 10. LLM (REQ-LLM)
- Role: extract values only.
- Request: `{templateId, fields:[{id,label,type,help}], text}` with `text ≤ 20,000` chars.
- Output (Zod): `{fields: {[id]: {value: string|null, quote: string|null}}}`.
- Grounding: `quote` MUST be a substring of input after whitespace normalisation; for typed fields, digits(value) MUST appear in digits(quote); otherwise proposal rejected and counted.
- Proposals appear in a review panel with quote highlighted; never auto-applied; never overwrite a filled field silently.
- temperature 0; timeout; ≤ 1 retry. Prompt in `src/llm/prompts/extract.v1.md` (versioned).
- BYOK: key in memory only. Adapter behind `LlmProvider` interface; first adapter Anthropic; verify provider CORS from browser (HUMAN).
- ReplayProvider: fixtures keyed by sha256 of canonical request JSON.

## 11. Evaluation (REQ-EVAL)
- ≥ 15 cases in `eval/cases/`: incl. absent fields, conflicting values, noisy formatting, ≥ 2 prompt-injection, ≥ 2 no-data.
- Metrics: precision, recall, F1, abstention rate, fabrication count, quote rejections, latency.
- Gate: accepted fabrications = 0 (hard). All other metrics: baseline-regression only (no invented thresholds).
- `eval` offline via replay; `eval:record`/`eval:live` human-run.

## 12. Repo & CI (REQ-REPO)
- CI: lint, typecheck, unit + property tests (fast-check), coverage, template lint, build, e2e (Playwright + axe), CodeQL, Scorecard, `npm audit --omit=dev`, Dependabot.
- Conventional Commits, squash merges, ADRs (seeds: client-only; own tag replacement instead of docxtemplater; docx-preview; LLM behind interface + quote grounding + replay; Pages + meta CSP; computed numbering; bounded zip reading).
- Skip: SBOM, Docker, Husky, i18n, mutation testing, mandatory signed commits, release automation.

## 13. Open items and defaults
| Item | Default |
|---|---|
| Repo name | `minutas-lab` |
| License | MIT |
| First LLM adapter | Anthropic |
| Zip library | decide via ADR (JSZip vs fflate + bounded inflation) |
| CC validator | experimental/warning |
| NIF prefix list | not enforced |
| M8 | minimal, after M7 |
| Upload of tagged template | optional, after M4 |
| AI-assisted declaration + co-author trailer | keep |
| Hosting | GitHub Pages; verify terms; Cloudflare Pages `_headers` = unverified alternative |
