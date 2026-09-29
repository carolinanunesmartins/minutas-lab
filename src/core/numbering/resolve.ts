import { clauseOrdinal } from '../validators/extenso';
import type { BlockPathEntry } from './blocks';
import type { ClassifiedParagraph, TagNode } from '../tags/types';

export type BlockValues = Readonly<Record<string, boolean>>;

type StackEntry = BlockPathEntry;

function isEntrySatisfied(entry: StackEntry, values: BlockValues): boolean {
  if (entry.type === 'block') return Boolean(values[entry.id]);
  return entry.branch === 'then' ? Boolean(values[entry.id]) : !values[entry.id];
}

function isBlockMarkerParagraph(paragraph: ClassifiedParagraph): TagNode | null {
  const tagNodes = paragraph.nodes.filter((n) => n.kind === 'tag');
  if (tagNodes.length !== 1) return null;
  const node = (tagNodes[0] as Extract<(typeof tagNodes)[number], { kind: 'tag' }>).node;
  const blockish = node.kind === 'blockOpen' || node.kind === 'blockClose' || node.kind === 'condOpen' || node.kind === 'condElse' || node.kind === 'condClose';
  return blockish ? node : null;
}

/** Which paragraphs render at all, given concrete block/condition truthiness. */
export function resolveVisibility(paragraphs: ClassifiedParagraph[], values: BlockValues): boolean[] {
  const stack: StackEntry[] = [];
  const visible: boolean[] = [];

  for (const paragraph of paragraphs) {
    const marker = isBlockMarkerParagraph(paragraph);
    if (marker) {
      visible.push(false);
      if (marker.kind === 'blockOpen') {
        stack.push({ type: 'block', id: marker.id });
      } else if (marker.kind === 'blockClose') {
        stack.pop();
      } else if (marker.kind === 'condOpen') {
        stack.push({ type: 'cond', id: marker.id, branch: 'then' });
      } else if (marker.kind === 'condElse') {
        const top = stack.at(-1);
        if (top?.type === 'cond') top.branch = 'else';
      } else if (marker.kind === 'condClose') {
        stack.pop();
      }
    } else {
      visible.push(stack.every((e) => isEntrySatisfied(e, values)));
    }
  }
  return visible;
}

export type AnchorKind = 'cl' | 'pt' | 'al';

export interface AnchorNumber {
  kind: AnchorKind;
  cl: number;
  pt?: number;
  al?: number;
}

export interface NumberingResult {
  visible: boolean[];
  /** `${paragraphIndex}:${nodeIndex}` -> rendered text for a cl/pt/al marker. */
  markerText: Map<string, string>;
  anchors: Map<string, AnchorNumber>;
  /** `${paragraphIndex}:${nodeIndex}` -> rendered text for a {{ref:id}}. */
  refText: Map<string, string>;
}

function titleCase(ordinalCaps: string): string {
  return ordinalCaps
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length > 0 ? w.charAt(0).toLocaleUpperCase('pt-PT') + w.slice(1) : w))
    .join(' ');
}

function alLetter(n: number): string {
  // a, b, ... z, aa, ab, ... (spillover unlikely in practice, but not undefined).
  let out = '';
  let x = n;
  while (x > 0) {
    const rem = (x - 1) % 26;
    out = String.fromCharCode(97 + rem) + out;
    x = Math.floor((x - 1) / 26);
  }
  return out;
}

/**
 * Compute cl/pt/al numbers and {{ref:id}} display text for the *visible*
 * paragraphs of a document (REQ-NUM, SPEC.md §4). Hidden blocks don't
 * consume numbers, matching Word-like conditional rendering.
 */
export function resolveNumbering(paragraphs: ClassifiedParagraph[], values: BlockValues): NumberingResult {
  const visible = resolveVisibility(paragraphs, values);
  const markerText = new Map<string, string>();
  const anchors = new Map<string, AnchorNumber>();
  const pendingRefs: { key: string; target: string; currentCl: number }[] = [];

  let cl = 0;
  let pt = 0;
  let al = 0;

  paragraphs.forEach((paragraph, paragraphIndex) => {
    if (!visible[paragraphIndex]) return;
    paragraph.nodes.forEach((node, nodeIndex) => {
      if (node.kind !== 'tag') return;
      const key = `${paragraphIndex}:${nodeIndex}`;
      const t = node.node;
      if (t.kind === 'cl') {
        cl += 1;
        pt = 0;
        al = 0;
        markerText.set(key, clauseOrdinal(cl));
        if (t.anchor !== undefined) anchors.set(t.anchor, { kind: 'cl', cl });
      } else if (t.kind === 'pt') {
        pt += 1;
        al = 0;
        markerText.set(key, String(pt));
        if (t.anchor !== undefined) anchors.set(t.anchor, { kind: 'pt', cl, pt });
      } else if (t.kind === 'al') {
        al += 1;
        markerText.set(key, alLetter(al));
        if (t.anchor !== undefined) anchors.set(t.anchor, { kind: 'al', cl, pt, al });
      } else if (t.kind === 'ref') {
        pendingRefs.push({ key, target: t.target, currentCl: cl });
      }
    });
  });

  const refText = new Map<string, string>();
  for (const { key, target, currentCl } of pendingRefs) {
    const anchor = anchors.get(target);
    if (!anchor) continue; // REF_UNKNOWN already reported by M1's tag validator.
    const clauseName = titleCase(clauseOrdinal(anchor.cl));
    if (anchor.kind === 'cl') {
      refText.set(key, `Cláusula ${clauseName}`);
    } else if (anchor.kind === 'pt') {
      refText.set(key, anchor.cl === currentCl ? `n.º ${anchor.pt}` : `n.º ${anchor.pt} da Cláusula ${clauseName}`);
    } else {
      // SPEC.md §4 only documents pt/cl ref text; al ref text extends that pattern.
      const suffix = anchor.cl === currentCl ? `n.º ${anchor.pt}` : `n.º ${anchor.pt} da Cláusula ${clauseName}`;
      refText.set(key, `alínea ${alLetter(anchor.al ?? 0)}) do ${suffix}`);
    }
  }

  return { visible, markerText, anchors, refText };
}
