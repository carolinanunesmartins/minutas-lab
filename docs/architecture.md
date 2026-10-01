# Architecture

Everything runs in the browser. See `README.md` for the diagram and `AGENTS.md` §3 for the layout.

| Area | Responsibility |
|---|---|
| `src/core/docx` | bounded zip read, run-map, tag span replacement, DOCX build |
| `src/core/tags`, `numbering`, `template` | tag grammar, cl/pt/al numbering, meta + rules + validation |
| `src/core/validators`, `formats` | NIF/NIPC/IBAN/CC, extenso, dates, euros |
| `src/core/import` | blank-minuta importer: detect → infer → generate (ADR-0008) |
| `src/workers` | DOCX build worker used by the live preview |
| `src/ui` | React UI; all user strings in `messages.pt.ts` |
| `templates/`, `fixtures/` | the only places `.docx` files may live |

Dependency rule (enforced by ESLint): `src/core` never imports from `src/ui`.
