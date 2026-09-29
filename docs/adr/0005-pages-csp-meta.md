# ADR-0005: GitHub Pages hosting with CSP delivered via `<meta>`

## Status
Accepted

## Context
Given ADR-0001 (client-only), hosting only needs to serve static files. GitHub Pages is free, integrates with GitHub Actions deploys, and needs no separate account/infra (SPEC §13 default). Static hosts typically can't set custom HTTP response headers, so a Content-Security-Policy can't be delivered as a `Content-Security-Policy` header — it has to be a `<meta http-equiv="Content-Security-Policy">` tag in `index.html` instead.

## Decision
- Host on GitHub Pages, Pages source = GitHub Actions (HUMAN repo-settings step, see ROADMAP.md M0).
- Deliver CSP via `<meta>` in `index.html`, per SPEC §9:
  `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src <LLM origin>; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'`.
- At M0, `connect-src` is set to `'self'` as a placeholder since no LLM adapter exists yet; it will be updated to the real LLM origin(s) when the Anthropic adapter lands (M6, T6.1).

## Consequences
- `<meta>` CSP cannot express `frame-ancestors` or HSTS (SPEC §9 limits) — these protections are simply unavailable on this hosting choice. Accepted as a known limitation.
- If GitHub Pages' terms or `<meta>`-CSP limitations turn out to be a blocker, Cloudflare Pages with a `_headers` file (real HTTP header, supports `frame-ancestors`/HSTS) is the unverified fallback noted in SPEC §13 — not adopted now, would need its own ADR if switched to.
- CI needs a `deploy` workflow building the Vite app (`base: './'`) and publishing to Pages (T0.3) — written now, first run deferred until the GitHub remote exists.
