// Shared button treatments — keeps press/focus feedback consistent without a
// component wrapper (Emil Kowalski: buttons must feel responsive to press).
const base =
  'inline-flex items-center justify-center gap-2 rounded font-medium transition-transform duration-150 ease-out-quart active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100';

export const buttonPrimary = `${base} bg-brass-500 px-4 py-2 text-sm text-brass-ink hover:bg-brass-400 disabled:bg-ink-700 disabled:text-white/40`;

export const buttonSecondary = `${base} border border-line px-4 py-2 text-sm text-white/90 hover:border-line-strong hover:bg-white/5 disabled:border-line disabled:text-white/30`;

export const buttonGhost = `${base} px-2 py-1 text-xs text-white/60 hover:text-white`;

export const buttonSecondaryOnPaper = `${base} border border-paper-line px-3 py-1.5 text-xs text-paper-ink hover:bg-paper-dim disabled:opacity-40`;
