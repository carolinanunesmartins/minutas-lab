# ADR-0008: Import a minuta with blanks (deterministic)

## Status
Accepted

## Context
Templates were hand-tagged with `{{id:type}}`. Users want to upload a minuta with blanks (`[Nome do Vendedor]`, `__/__/____`) and get a template. Uploading *filled* contracts would put real personal data through detection (GDPR), so the flow is restricted to blank minutas.

## Decision
- Detection is deterministic (`src/core/import/detect.ts`): bracket blanks (the bracket text is the label), date blanks, underscore/dot runs; instruction brackets ("escolher uma…") are skipped.
- Field id/type/role/group/options are inferred by pt-PT keyword heuristics (`infer.ts`). The same role + normalized label is one field, so repeated blanks share an input.
- Generation (`generate.ts`) reuses `replaceTagsInParagraph`, then lints the output with the same parser/meta loader as `npm run lint:templates`.
- A document that contains checksum-valid NIF/IBAN or emails is flagged in the UI as probably filled (`safeguard.ts`). An optional LLM refinement step existed briefly and was removed (ADR-0009).
- Quality gate: `npm run eval:import` / `tests/unit/core/import/roundtrip.test.ts` blank every value tag of the shipped templates (two label styles) and require 100% of inputs recovered with the same type, modifier and id grouping.

## Consequences
- No new runtime dependency; no backend; no network access.
- The heuristics are tuned on the four shipped templates; new minuta styles may need new rules and should be added to the round-trip eval.
- Out of scope: conditional blocks, automatic clause numbering, PDFs, headers/footers.
