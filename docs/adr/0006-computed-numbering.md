# ADR-0006: Computed numbering, resolved in two passes over the visible document

## Status
Accepted

## Context
SPEC.md §4 requires `{{cl}}`/`{{pt}}`/`{{al}}` to render as ordinals/numbers computed from the document's actual structure — "counters computed after blocks are resolved (hidden blocks don't consume numbers)" — and `{{ref:id}}` to render as "n.º 4 da Cláusula Primeira", omitting the clause part when the reference and its target share a clause. This can't be computed statically from the template alone: which blocks are hidden depends on the user's field values, so the same template can produce different clause/point numbers for different users.

A second, independent problem: a `{{ref:id}}` can point at an anchor that lives inside a conditional block the ref itself isn't (also) inside — the anchor could be hidden while the ref still renders, producing "n.º 4 da Cláusula" pointing at nothing. This needs to be catchable at **lint time**, before any concrete field values exist.

## Decision
Split into two independent modules under `src/core/numbering`:

- **`blocks.ts` (static, lint-time)**: walks the parsed document once, recording each anchor's and each `{{ref:id}}`'s *block-nesting path* — the stack of enclosing `{{#id}}`/`{{#se id}}` blocks (and, for conditionals, which branch) at that point in the document. `findHiddenRefs` flags a ref as `REF_TARGET_HIDDEN` whenever its target anchor's path is *not a prefix* of the ref's own path — i.e., the ref isn't nested at least as deep inside the same conditions as its target, so the anchor could be hidden while the ref renders. No field values needed; this runs in `lint:templates`.
- **`resolve.ts` (dynamic, runtime)**: given concrete block-visibility values, first computes which paragraphs are visible (a block-marker paragraph is never itself visible content; content paragraphs are visible iff every enclosing block/condition is satisfied), then walks only the visible paragraphs in order, incrementing `cl`/`pt`/`al` counters and building the anchor→number registry, then resolves every `{{ref:id}}`'s display text from that registry (two passes, since a ref can point forward to an anchor not yet counted in a single forward pass).

Both modules key positions as `` `${paragraphIndex}:${nodeIndex}` `` into the parsed AST (not raw string offsets) — `src/core/docx/build.ts` (M4) is the only place that needs to re-project those keys onto actual character spans in the run-map, via `findTagSpans`, keeping this module free of any DOM/OOXML concern.

## Consequences
- `REF_TARGET_HIDDEN` is caught once, statically, for every possible combination of field values — not by exhaustively simulating visibility combinations at runtime.
- Numbering is naturally correct for hidden blocks: since `resolveNumbering` only iterates *visible* paragraphs, a hidden block's `{{pt}}` markers are never counted, with no special-casing needed.
- Clause ordinal text for `{{cl}}` itself (all-caps, e.g. "PRIMEIRA") and for `{{ref:cl_x}}` (title-case, "Cláusula Primeira") intentionally differ — SPEC.md §4's own example uses title case for the reference text while §4's marker-rendering rule says caps; `resolve.ts` derives the title-case form from `clauseOrdinal()` (`src/core/validators/extenso.ts`) rather than maintaining a second ordinal list.
- `{{al}}` has no anchor form in the grammar (SPEC.md §3 doesn't give it one), so alínea refs aren't representable — `resolve.ts`'s `al`-kind ref-text branch is a documented best-effort extension beyond what SPEC.md explicitly specifies (see the comment in `resolve.ts`), since no template drafted so far (M5) needed it.
