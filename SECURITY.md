# Security Policy

`minutas-lab` is a client-side-only app (AGENTS.md §4, rule 1): no server, no telemetry, no database. Threats of interest are mainly in the browser: malicious/malformed DOCX uploads, XSS via inserted field values, CSP bypass, and hostile content in imported `.docx` files.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository (Security tab → "Report a vulnerability") rather than opening a public issue. *This requires the repository's private vulnerability reporting to be enabled — that's a HUMAN/repo-settings step (see `ROADMAP.md` M0) not yet done in the local-only phase.*

Until the repository exists on GitHub, do not report vulnerabilities through public channels for this project.

## Supported versions

Only the latest `main` is supported; there are no maintained release branches.

## Security model in brief

- Everything runs in the browser; uploaded `.docx` files are size-bounded, stripped of external relationships and rejected when they carry macros, path traversal or style names that could inject CSS (`src/core/docx/zip.ts`, `sanitize.ts`).
- The app never handles API keys or credentials and makes no third-party network requests (CSP `connect-src 'self'`).
- CI runs CodeQL, OpenSSF Scorecard, `npm audit --omit=dev`, dependency review on PRs and a repo-policy guard (no `.docx` outside `templates/`/`fixtures/`, no env files, no key-like strings).

## Scope

In scope:
- The web app itself (`src/`), including DOCX parsing/rendering, tag substitution.
- Build and CI configuration (`.github/`).

Out of scope:
- Vulnerabilities in third-party templates supplied by users outside `templates/`/`fixtures/`.

## Response

Best-effort; there is no SLA at this stage of the project.
