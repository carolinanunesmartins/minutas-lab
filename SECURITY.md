# Security Policy

`minutas-lab` is a client-side-only app (AGENTS.md §4, rule 1): no server, no telemetry, no database. Threats of interest are mainly in the browser: malicious/malformed DOCX uploads, XSS via inserted field values, CSP bypass, and prompt-injection against the optional LLM extraction feature.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository (Security tab → "Report a vulnerability") rather than opening a public issue. *This requires the repository's private vulnerability reporting to be enabled — that's a HUMAN/repo-settings step (see `ROADMAP.md` M0) not yet done in the local-only phase.*

Until the repository exists on GitHub, do not report vulnerabilities through public channels for this project.

## Scope

In scope:
- The web app itself (`src/`), including DOCX parsing/rendering, tag substitution, and the LLM extraction adapter.
- Build and CI configuration (`.github/`).

Out of scope:
- Vulnerabilities in third-party templates supplied by users outside `templates/`/`fixtures/`.

## Response

Best-effort; there is no SLA at this stage of the project.
