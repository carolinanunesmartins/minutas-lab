# ADR-0009: Remove LLM features from the MVP

## Status
Accepted (supersedes ADR-0004)

## Context
The optional LLM features (field extraction from pasted text, and LLM refinement of imported blanks) needed the user's own Anthropic API key. API access is billed separately from any Claude subscription, which does not make sense for an MVP that is meant to be free to try, offline-capable and demonstrable to a client without credentials.

## Decision
Remove the LLM code path entirely: `src/llm/`, the extraction panel, the LLM section of the import panel, the LLM eval harness and its npm scripts (`eval`, `eval:record`, `eval:live`), and the Anthropic API origin in the CSP `connect-src`. The blank-minuta importer (ADR-0008) stays and is fully deterministic: detection, heuristic inference, review UI, generation and lint all run locally.

## Consequences
- The app makes no third-party network request at runtime; `connect-src` is `'self'`.
- The importer's quality gate is `npm run eval:import` (100% round-trip on the shipped templates).
- `zod` was removed later together with the save/open JSON feature (its only user), so the runtime dependencies are `docx-preview`, `fflate`, `@xmldom/xmldom`, React.
- If an AI feature returns later, it should come back as a new ADR, ideally with a free/local option, and re-introduce a provider interface, output validation and a replay-based eval.
