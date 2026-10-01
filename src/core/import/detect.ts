// M8 (ROADMAP.md): find the blanks ("lacunas") in a blank-filled minuta.
// Pure string work — callers pass paragraph texts (DocxParagraph.text), so the
// offsets line up with the run-map used by replaceTagsInParagraph.

export type BlankKind = 'bracket' | 'date' | 'underscore' | 'dots';

export interface Blank {
  paraIndex: number;
  start: number;
  end: number;
  raw: string;
  kind: BlankKind;
  /** Bracket content ("Nome do Vendedor"), trimmed; null for unlabeled blanks (___, …). */
  label: string | null;
  /** Up to CONTEXT_CHARS of paragraph text on either side (other blanks included verbatim). */
  left: string;
  right: string;
}

const CONTEXT_CHARS = 60;

// Order matters: a date blank (`__/__/____`) must win over the plain underscore run.
const BLANK_PATTERNS: { kind: BlankKind; re: RegExp }[] = [
  { kind: 'date', re: /_+\s*\/\s*_+\s*\/\s*_+/g },
  { kind: 'bracket', re: /\[([^[\]]+)\]/g },
  { kind: 'underscore', re: /_{2,}/g },
  { kind: 'dots', re: /\.{4,}|…+/g },
];

/** "[escolher uma: …]" style instruction brackets pick between alternatives — not a fillable value. */
const CHOICE_LABEL = /^\s*(escolher|escolha|opç|opc|selecionar|apagar|eliminar)/i;

export interface DetectResult {
  blanks: Blank[];
  /** Instruction brackets skipped as choices (MVP: not converted). */
  skippedChoices: number;
  /** Underscore/dot runs skipped because they are signature lines. */
  skippedSignatures: number;
}

/**
 * A run of underscores/dots that is the whole paragraph (or only has an "assinatura"
 * caption next to it) is a signature line, not a value to fill in.
 */
function isSignatureLine(text: string, raw: string): boolean {
  const rest = text.replace(raw, '').trim();
  return rest === '' || /assina/i.test(rest);
}

export function detectBlanks(paragraphTexts: readonly string[]): DetectResult {
  const blanks: Blank[] = [];
  let skippedChoices = 0;
  let skippedSignatures = 0;

  paragraphTexts.forEach((text, paraIndex) => {
    const found: Omit<Blank, 'left' | 'right'>[] = [];
    const taken: [number, number][] = [];
    const overlaps = (s: number, e: number): boolean => taken.some(([a, b]) => s < b && e > a);

    for (const { kind, re } of BLANK_PATTERNS) {
      for (const m of text.matchAll(re)) {
        const start = m.index;
        const end = start + m[0].length;
        if (overlaps(start, end)) continue;
        const label = kind === 'bracket' ? (m[1] ?? '').trim() : null;
        if (kind === 'bracket' && (label === '' || CHOICE_LABEL.test(label ?? ''))) {
          skippedChoices += label === '' ? 0 : 1;
          taken.push([start, end]);
          continue;
        }
        taken.push([start, end]);
        if ((kind === 'underscore' || kind === 'dots') && isSignatureLine(text, m[0])) {
          skippedSignatures += 1;
          continue;
        }
        found.push({ paraIndex, start, end, raw: m[0], kind, label });
      }
    }

    found.sort((a, b) => a.start - b.start);
    for (const b of found) {
      blanks.push({
        ...b,
        left: text.slice(Math.max(0, b.start - CONTEXT_CHARS), b.start),
        right: text.slice(b.end, b.end + CONTEXT_CHARS),
      });
    }
  });

  return { blanks, skippedChoices, skippedSignatures };
}
