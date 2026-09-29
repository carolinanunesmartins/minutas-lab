# Adding a template

A template lives at `templates/<slug>/` and has exactly two files the app reads: `template.docx` (the tagged contract body) and `template.meta.json` (field/group/rule metadata — schema in `src/core/template/meta.ts`, normative description in `SPEC.md` §5).

## Hard requirements (AGENTS.md §4)

- **Original content only.** Every template must be a clean-room / synthetic drafting — never a copy or close paraphrase of a real law firm's or third party's document. `templates/` and `fixtures/` are the only places `.docx` files are allowed in this repo.
- **No real personal data.** Any example values (names, NIFs, addresses) used while drafting or testing must be fabricated. The CPCV test vectors in `SPEC.md` §6 are already synthetic — reuse those where a template needs a NIF/IBAN example.
- **No legal-validity claims.** The app calls formats "formato válido", never "juridicamente válido"; the preview is labelled approximate. Every template's source should end with a `=== PONTOS A VALIDAR POR JURISTA ===` section listing anything a human lawyer should confirm before this template is used for real (see `templates/cpcv/source.txt` for the pattern) — this is expected, not optional, since agents draft these templates without legal qualification.

## Tag grammar

Full grammar is `SPEC.md` §3-4; the short version:

| Tag | Meaning |
|---|---|
| `{{id}}` / `{{id:type}}` / `{{id:type\|modifier}}` | value tag. `type` ∈ `text nif nipc iban cc data eur int` (default `text`). `modifier` ∈ `extenso upper` (`extenso` only on `eur`/`int`). |
| `{{#id}} … {{/id}}` | shown only if `id` is non-empty/true |
| `{{#se id}} … {{#senao}} … {{/se}}` | conditional with an else branch |
| `{{cl}}` / `{{cl anchor_id}}` | next clause ordinal (caps). Anchor id is optional, used for `{{ref:}}`. |
| `{{pt}}` / `{{pt anchor_id}}` | next point number within the current clause |
| `{{al}}` | next alínea letter within the current point (no anchor — not referenceable) |
| `{{ref:anchor_id}}` | cross-reference, renders as "Cláusula X" / "n.º N" / "n.º N da Cláusula X" |
| `\{{` | literal `{{` |

Rules that will fail `npm run lint:templates` if violated:
- Block/conditional tags (`#id`, `#se`, `#senao`, `/id`, `/se`) must be **alone in their paragraph** — nothing else, not even whitespace text.
- A `{{ref:x}}` must not be reachable somewhere its target anchor could be hidden (i.e. the anchor's enclosing blocks must all also enclose the ref) — this is `REF_TARGET_HIDDEN`.
- Every id used as `{{#id}}`/`{{#se id}}`/a value tag must appear in `template.meta.json`'s `fields`, or vice versa (`META_UNKNOWN_FIELD`).

## Authoring workflow

1. Draft the contract body as `templates/<slug>/source.txt`, following `templates/cpcv/source.txt`'s layout:
   - Plain-text body first (one logical paragraph per line; `**bold**` for inline bold, `CLÁUSULA {{cl}}` lines, `(Título)` lines right after a clause line, `{{pt}}.`/`{{al}})` prefixes).
   - `=== CAMPOS ===` then one field per line: `id | type | obrigatório?(sim/não/condicional) | label`.
   - `=== ÂNCORAS ===` then one anchor per line: `anchor_id | what it is | where it's referenced from` (documentation only, not parsed).
   - `=== PONTOS A VALIDAR POR JURISTA ===` — numbered list (required, see above).
2. Sanity-check the tag grammar before building the `.docx`: `python scripts/lint.py templates/<slug>/source.txt` (quick, dependency-free) catches syntax/block/ref errors early; `npm run lint:templates` (below) is the authoritative check since it runs the same engine the app uses.
3. Build the `.docx`: `npx tsx scripts/build-template-docx.ts templates/<slug>/source.txt templates/<slug> --title "..."`. This also writes a **skeleton** `template.meta.json` from the `=== CAMPOS ===` table — edit it afterwards to add `groups`, `default`/`emptyText`/`help`, and `rules` (SPEC.md §5). It produces plain paragraph/clause/point formatting only (no footer page-number field) — good enough for `docx-preview` and the app's own pipeline; a human touching the file up in Word afterwards is fine as long as it's saved once (SPEC.md §7) and the tags survive.
4. `npm run lint:templates` — must report the template OK.
5. Add a golden-output test under `tests/unit/core/docx/` (pattern: `templates/cpcv`'s coverage in `build.test.ts`) with a full synthetic demo value set, asserting the built document contains the expected substituted text and no leftover `{{` tags.
6. `npm run verify`.

## Generator script vs. hand-editing in Word

`scripts/build-template-docx.ts` produces a plain, consistently-styled `.docx` (title/clause/point formatting) directly from `source.txt` — no Word installation needed, and `source.txt` stays the reviewable/diffable source of truth. If a template is instead hand-edited in Word, save it **once** (SPEC.md §7) so run-splitting stays predictable, and there is no `source.txt` to regenerate from — the `.docx` becomes the source of truth for that template.
