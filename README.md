# minutas-lab

Browser-only web app for filling Portuguese legal contract templates (DOCX with `{{tags}}`): pick a template, fill a validated form, see a live Word-like preview, download the complete DOCX. Optional LLM-assisted extraction of field values from pasted text (proposals only, never auto-applied). No backend, no database, no analytics.

See [`AGENTS.md`](./AGENTS.md) for the full contributor/agent contract, [`SPEC.md`](./SPEC.md) for normative requirements, and [`ROADMAP.md`](./ROADMAP.md) for milestones.

## AI-assisted development

This project is built with substantial AI (LLM agent) assistance under human review — commits authored by an agent carry a co-author trailer, and every change must pass `npm run verify` before merge. See `AGENTS.md` for the autonomous workflow rules agents follow in this repo.

## Quickstart

```bash
npm ci
npm run dev
```

## Commands

| Command | Purpose |
|---|---|
| `npm ci` | install (lockfile only) |
| `npm run dev` | Vite dev server |
| `npm run verify` | typecheck + lint + unit tests + template lint + build — must pass before every commit/PR |
| `npm run test:cov` | unit tests with coverage |
| `npm run test:e2e` | Playwright + axe |
| `npm run lint:templates` | validates every `templates/*/template.docx` + `template.meta.json` |
| `npm run eval` | LLM eval with ReplayProvider (offline, deterministic) |
| `npm run eval:record` / `eval:live` | human-run only, need `LLM_API_KEY` |

## Status

Early scaffold (M0). Nothing is deployed yet.

## License

MIT — see [`LICENSE`](./LICENSE).
