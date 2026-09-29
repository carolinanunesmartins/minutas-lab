# Contributing

Read [`AGENTS.md`](./AGENTS.md) first — it's the binding contract for both human and agent contributors (layout, hard rules, definition of done, workflow). [`SPEC.md`](./SPEC.md) has the normative requirements (REQ-*). [`ROADMAP.md`](./ROADMAP.md) has milestones and status.

## Workflow

- Branch naming: `agent/<milestone>-<slug>` (e.g. `agent/m0-foundation`).
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, ...).
- One PR per milestone; squash merge.
- `npm run verify` must pass before every commit/PR.
- New logic needs unit tests (property tests for validators/extenso/tag parser).
- User-facing strings only in `src/ui/messages.pt.ts` (pt-PT).
- No `any`, no `// @ts-ignore`, no skipped tests, no TODO without an issue link.

## Setup

```bash
npm ci
npm run dev
```

## Before opening a PR

```bash
npm run verify
```

Update `CHANGELOG.md` and add an ADR under `docs/adr/` if you made an architectural decision (see AGENTS.md §12 for the seed list).
