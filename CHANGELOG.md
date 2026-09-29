# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- M0 scaffold: Vite + React + TypeScript (strict) + Tailwind, ESLint (flat config, `src/core` import boundary), Prettier, Vitest.
- Repo meta files: README, LICENSE (MIT), SECURITY.md, CONTRIBUTING.md, issue/PR templates, CODEOWNERS, Dependabot config.
- CSP `<meta>` per SPEC §9; ADR-0001 (client-only) and ADR-0005 (Pages + meta CSP).
- CI workflow definitions (`ci`, `codeql`, `deploy`, `scorecard`) — written but not yet run (no remote repo in the local-only phase).
- Synthetic CPCV draft template (`templates/cpcv/`) plus its authoring tooling (`scripts/build_template_docx.py`, `lint.py`, `render_demo.py`).
- M1 tag engine (`src/core/tags`, `src/core/docx`): tag parser for SPEC §3 grammar (value tags, blocks, `{{#se}}` conditionals, `cl`/`pt`/`al`/`ref`, `\{{` escape) with all applicable error codes; bounded `.docx` zip reading (ADR-0007, `fflate`); paragraph run-map extraction incl. table cells; span replacement preserving the first run's formatting with automatic XML escaping (ADR-0002). `REF_TARGET_HIDDEN` and `META_UNKNOWN_FIELD` are deferred to M3 (need numbering/meta-schema machinery not built yet).
- Synthetic split-run/table-cell fixture generator (`scripts/generate-fixtures.ts` → `fixtures/split-runs.docx`).
- M2 validators/formats (`src/core/validators`, `src/core/formats`): NIF/NIPC checksum, IBAN PT mod-97, dd/mm/aaaa date parsing with real-calendar validation, pt-PT eur (integer cents) and int parsing/formatting, CC format check (marked experimental — no verified checksum spec was available, see `src/core/validators/cc.ts`). pt-PT number-to-words extenso (euros + cêntimos) and clause ordinals (1-20 per SPEC §4, algorithmic beyond that). All SPEC §6 test vectors covered, plus property tests (IBAN mod-97 invariant, extenso never crashes/negatives up to ~10M).
