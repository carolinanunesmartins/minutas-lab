# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- M0 scaffold: Vite + React + TypeScript (strict) + Tailwind, ESLint (flat config, `src/core` import boundary), Prettier, Vitest.
- Repo meta files: README, LICENSE (MIT), SECURITY.md, CONTRIBUTING.md, issue/PR templates, CODEOWNERS, Dependabot config.
- CSP `<meta>` per SPEC §9; ADR-0001 (client-only) and ADR-0005 (Pages + meta CSP).
- CI workflow definitions (`ci`, `codeql`, `deploy`, `scorecard`) — written but not yet run (no remote repo in the local-only phase).
