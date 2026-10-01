# AGENTS.md — minutas-lab

Language: English. Read order for any agent: this file → `SPEC.md` → `ROADMAP.md` (pick the first milestone with status `todo` whose dependencies are `done`).

## 1. What this is
Browser-only web app. User picks a Portuguese legal contract template (DOCX with `{{tags}}`), fills a validated form, sees a live Word-like preview, downloads the complete DOCX. Upload of a minuta with blanks that is converted into a tagged template (deterministic, no AI). No backend, no database, no analytics.

## 2. Commands (must exist after M0; keep names stable)
| Command | Purpose |
|---|---|
| `npm ci` | install (lockfile only) |
| `npm run dev` | Vite dev server |
| `npm run verify` | typecheck + lint + unit tests + template lint + build. **Must pass before every commit/PR** |
| `npm run test:cov` | unit tests with coverage |
| `npm run test:e2e` | Playwright + axe |
| `npm run lint:templates` | validates every `templates/*/template.docx` + `template.meta.json` |
| `npm run eval:import` | blank-minuta importer round-trip on the shipped templates (must be 100%) |
| `npm run check:policy` | repo policy guard (no `.docx` outside `templates/`/`fixtures/`, no env files, no key-like strings) |

## 3. Layout
```
.github/{workflows,ISSUE_TEMPLATE,dependabot.yml,PULL_REQUEST_TEMPLATE.md,CODEOWNERS}
docs/{adr/,architecture.md,templates.md}
fixtures/        synthetic .docx/.json used by tests (allowed to contain .docx)
templates/<slug>/{template.docx,template.meta.json}
src/core/        pure TS: tags, numbering, validators, extenso, formats, docx read/write. NO DOM, NO fetch
src/core/import/ blank-minuta importer: detect, infer, generate, safeguard
src/workers/     docx build worker
src/ui/          React components, messages.pt.ts
tests/{unit,property,e2e}/
Root files: AGENTS.md CLAUDE.md SPEC.md ROADMAP.md README.md SECURITY.md CONTRIBUTING.md CHANGELOG.md LICENSE BLOCKERS.md(only when blocked)
```

## 4. Hard rules (violating any = PR rejected)
1. Client-side only. No server code, no telemetry, no third-party runtime requests.
2. No real personal data anywhere. `.docx` files exist only under `templates/` and `fixtures/`. `private/` is gitignored. Never commit third-party (law-firm) material.
3. No AI/LLM or other paid service at runtime in the MVP (ADR-0009). Contract text is never generated, only filled in.
4. Anything derived from an uploaded file is untrusted: size-bound, sanitise, validate, never render as HTML.
5. No secrets anywhere: the app never asks for API keys, and agents never see or request credentials.
6. `src/core` must not import from `src/ui` (ESLint `no-restricted-imports`).
7. Every inserted value is XML-escaped; uploads pass the input guard (SPEC §9) before any parsing.
8. GitHub Actions pinned by full commit SHA; workflow `permissions:` least-privilege; no `pull_request_target`.
9. No compliance/legal-validity claims in UI or docs ("formato válido", never "NIF válido"; preview labelled approximate).
10. Minimal dependencies. New runtime dependency requires an ADR (`docs/adr/`).

## 5. Definition of Done (per PR)
- `npm run verify` green; new logic has unit tests (property tests for validators/extenso/tag parser).
- Acceptance checklist of the milestone in `ROADMAP.md` ticked in the PR description.
- Docs updated (`docs/`, ADR if a decision was made, CHANGELOG entry).
- No `any`, no `// @ts-ignore`, no skipped tests, no TODO without an issue link.
- User-facing strings only in `src/ui/messages.pt.ts` (pt-PT).

## 6. Autonomous workflow
- Branch `agent/<milestone>-<slug>`; one PR per milestone; Conventional Commits; squash merge.
- Never push to `main`, force-push, merge own PR, change repo settings/secrets, or edit `.github/workflows` permissions beyond least-privilege.
- Commits end with the co-author trailer supplied by the harness.
- Uncertain? Prefer the default in SPEC §13. If none exists or the change is irreversible: create `BLOCKERS.md` (what, options, recommended default), open the PR as draft, stop.
- Tasks tagged `HUMAN:` in ROADMAP are never attempted by agents; list them in the PR description.
- Do not invent numeric thresholds; use those in SPEC or record a baseline.
- Local-only phase (no remote yet): work on branches in the local git repo, skip anything needing GitHub (CI runs, Pages, branch protection) and list it as `HUMAN:`/deferred in the PR description.
