// REQ-EVAL: full eval harness (ReplayProvider, ≥15 cases, metrics) lands in M6 (T6.4).
// `npm run eval` will run offline via ReplayProvider; eval:record/eval:live are HUMAN-run only
// and must never be invoked by agents (AGENTS.md §2).
const mode = process.argv.includes('--live') ? 'live' : process.argv.includes('--record') ? 'record' : 'replay';

console.log(`eval (${mode}) — not implemented yet, see ROADMAP M6.`);
