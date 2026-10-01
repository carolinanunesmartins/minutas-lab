# ROADMAP.md

Status values: `todo | doing | done | blocked`. Estimates are [Guessing] and were wrong (too low) in every earlier iteration; treat as ±40%. Stop points marked ★ are presentable.

`HUMAN:` = never done by an agent.

## M0 — Repo foundation (3h) · status: todo · deps: HUMAN repo creation
- HUMAN: create empty public repo (default name `minutas-lab`), grant agent write access limited to it, configure settings (branch protection on `main` requiring CI, secret scanning + push protection, private vulnerability reporting, default `GITHUB_TOKEN` read-only, Pages source = GitHub Actions).
- T0.1 Scaffold Vite + React + TS strict + Tailwind, ESLint, Prettier, Vitest; `base: './'`.
- T0.2 Files: README (with "AI-assisted development" declaration), LICENSE (MIT), SECURITY.md, CONTRIBUTING.md, CHANGELOG.md, AGENTS.md, issue/PR templates, CODEOWNERS, dependabot.yml.
- T0.3 CI workflows: `ci` (verify), `codeql`, `deploy` (Pages), `scorecard`; SHA-pinned actions; `npm audit --omit=dev` step.
- T0.4 CSP `<meta>` per SPEC §9; ADR-0001 client-only, ADR-0005 Pages + meta CSP.
- Accept: CI green on empty app; Pages deploys; `npm run verify` exists; no HUMAN item left unlisted.
- Local-only phase: T0.1, T0.2, T0.4 and writing (not running) T0.3 can be done before the remote exists; CI green / Pages / settings are deferred until the repo is pushed.

## M1 — Tag engine (4h) · todo · deps: M0
- T1.1 Read DOCX (bounded), extract paragraph run-map.
- T1.2 Tag parser per SPEC §3 incl. blocks, escape, error codes.
- T1.3 Span replacement preserving first run's rPr; XML escaping.
- T1.4 Generate synthetic fixture DOCX by script (`fixtures/`), incl. split-run tags and table-cell tags.
- Accept: fixtures with tags split over 1/2/3 runs replace correctly; every error code has a test; property test: parse(render(ast)) round-trips.

## M2 — Validators & formats (2h) · todo · deps: M0 (parallel with M1)
- T2.1 NIF, NIPC, IBAN PT, dates, eur, int; CC marked experimental.
- T2.2 Extenso (numbers, euros/cêntimos, ordinals for cláusulas).
- T2.3 Test vectors from SPEC §6.
- Accept: all vectors pass; property tests (extenso monotonic groups, IBAN mod-97 invariants).

## M3 — Template package, numbering, rules (5h) · todo · deps: M1, M2
- T3.1 `template.meta.json` types + loader + `lint:templates`.
- T3.2 Numbering `cl/pt/al` + `ref` resolution.
- T3.3 Conditional blocks + cross-field rules (SPEC §5).
- T3.4 Validation engine (layers 1–4, error/warning).
- Accept: fixture template with numbering, conditional block and refs renders correct output; dangling ref is a lint error.

## M4 — Form + live preview + download ★ (7h, cum ≈21h) · todo · deps: M3
- T4.1 Form generated from fields+meta, grouped, inline errors.
- T4.2 Worker build → docx-preview → double-buffer swap; shading of filled/active/empty.
- T4.3 Download final (0 errors) and draft; review screen; disclaimer paragraph.
- T4.4 Sanitise relationships; input guard; error UI for malformed DOCX.
- T4.5 a11y pass, keyboard nav, pt-PT messages.
- Accept: p95 edit→preview latency < 100 ms on fixture (CI gate 150 ms); downloaded DOCX opens with same text as preview; Playwright + axe green.
- HUMAN: provide ≥1 real template (see M5).

## M5 — Templates (3h) · todo · deps: M3 (parallel to M4)
- HUMAN: supply CPCV via clean-room rewrite or public model, tagged per docs/templates.md, saved once in Word.
- T5.1 Agent drafts original arrendamento, empreitada, procuração templates via generator script + meta.
- T5.2 Each passes `lint:templates`; golden-output tests.
- Accept: ≥3 templates selectable; golden tests green.

## M6 — LLM extraction · removed from the MVP (ADR-0009)
The API key needed for LLM features is a paid, separate product; the MVP stays free, offline and key-less. T6.1-T6.4 were deleted from the code (`src/llm/`, extraction panel, LLM eval). Revisit only via a new ADR.

## M7 — Polish ★ (4h) · todo · deps: M4, M5
- README with GIF, architecture diagram, ADRs finalised, Scorecard badge, coverage badge, e2e in CI.
- HUMAN: 2-minute video.
- Accept: fresh clone → `npm ci && npm run verify` green; README quickstart verified.

## M8 — Blank-minuta import (see ADR-0008) · doing · deps: M7
- Done on `agent/m8-blank-import`: T8.1 deterministic blank detectors (brackets, `___`, date blanks, valor/extenso pairs, choice instructions skipped), heuristic inference of id/type/role/group/options, review UI, generation with in-browser lint, filled-document warning, `npm run eval:import` 100% round-trip on the 4 shipped templates (two label styles).
- Remaining: e2e upload test; import of an already-tagged `.docx`; widen the round-trip eval when new minuta styles appear.
- Out of scope: conditional blocks, automatic clause numbering, PDF, headers/footers, any AI/LLM step.

## Optional
- Upload of user-provided tagged template (~1h, after M4), subject to input guard and `lint` in-browser.

## Cumulative [Guessing]
M0 3 · M1 7 · M2 9 · M3 14 · M4 21★ · M5 24 · M7 28★ · M8 +4.
