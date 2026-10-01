# ADR-0004: LLM behind a provider interface, with quote grounding and a replay mode

## Status
Superseded by ADR-0009 (the LLM features were removed from the MVP; kept for history)

## Context
M6 adds optional LLM-assisted extraction: the user pastes text, the model proposes values for the current template's fields. AGENTS.md §4 rule 3 is explicit that the LLM never writes clauses — it only proposes field values, which the SPEC.md §10 review flow may or may not accept. Two more constraints shape the design:
- **BYOK, key in memory only** (AGENTS.md §4 rule 5) — no backend to proxy the request through (ADR-0001), so the browser calls the provider directly.
- **Untrusted output** (AGENTS.md §4 rule 4) — a model can hallucinate a value that was never in the source text; SPEC.md §10 requires every proposal be *grounded* (its `quote` must be a real substring of the input, and for typed fields the value's digits must appear in the quote's digits) before it's even shown to the user, let alone applied.
- **Deterministic CI** — `npm run eval` (SPEC.md §11) must run offline, with zero accepted fabrications as a hard gate. That's incompatible with hitting a live API in CI.

## Decision
- `src/llm/types.ts` defines a narrow `LlmProvider` interface: `complete(request) => Promise<string>` (the model's raw text, unparsed). Every provider — real or replayed — returns through the exact same shape.
- `src/llm/extract.ts` is the single place that parses that raw text, validates it against a Zod schema (`src/llm/schema.ts`, matching SPEC.md §10's `{fields: {[id]: {value, quote}}}`), and grounds every proposal (`src/llm/grounding.ts`) — so grounding behaves identically regardless of which provider produced the text.
- `src/llm/anthropicProvider.ts`: the first (and only, for now) real adapter, direct browser → Anthropic API (BYOK). Sends `anthropic-dangerous-direct-browser-access` so the API accepts a browser-origin call; HUMAN must still verify this actually clears CORS for a real account (SPEC.md §10's own note) — untested against the live API in this session, no key available.
- `src/llm/replayProvider.ts`: fixtures keyed by `sha256(canonical JSON of the request)` (sorted keys, so field order doesn't change the hash) — deterministic and network-free, used by `npm run eval` and available for local dev without an API key.
- The prompt (`src/llm/prompts/extract.v1.md`) is versioned as its own file, bundled via Vite's `?raw` import (no filesystem access at runtime — this is a browser app, ADR-0001) rather than embedded as a string in code, so prompt changes are reviewable independently of adapter code and the version number in the filename is meaningful.

## Consequences
- Swapping providers (real vs. replay, or a future second adapter) never touches parsing/grounding logic — only `complete()`'s implementation differs.
- CSP's `connect-src` (index.html, ADR-0005) needs the Anthropic API origin now that this adapter exists — updated in this same change.
- The eval harness (SPEC.md §11, T6.4) is deterministic by construction: it can only ever exercise `ReplayProvider`, never the network.
- `zod` is a new runtime dependency (AGENTS.md §4 rule 10 — this ADR is that record). Chosen because SPEC.md §10 already names it explicitly as the validation approach.
