# ADR-0001: Client-only architecture

## Status
Accepted

## Context
`minutas-lab` fills Portuguese legal contract templates with user-supplied data (potentially personal data: names, NIFs, IBANs, addresses) and produces a downloadable DOCX. A traditional web app would run this through a server, which means that data crosses a network boundary and is retained (logs, DB, backups) unless deliberately avoided.

## Decision
The app is browser-only: no server code, no database, no analytics/telemetry, no third-party runtime requests except the configured LLM origin for the optional extraction feature (AGENTS.md §4 rule 1). DOCX parsing, tag substitution, validation, numbering, and rendering all run client-side (Web Worker for the build step). The only network calls are to the user's own LLM provider (BYOK), made directly from the browser.

## Consequences
- User data never leaves the browser unless the user explicitly opts into LLM extraction, and even then only the pasted text (not the full form) is sent, with an in-memory API key (AGENTS.md §4 rule 5).
- No backend means no server-side validation as a safety net — all validation logic must be trustworthy client-side code (`src/core`), tested thoroughly.
- Hosting can be static (see ADR-0005): GitHub Pages.
- File size/complexity limits (SPEC §9 input guard) matter more, since there's no server to offload heavy parsing to.
