import type { ClassifiedParagraph, TagError } from '../tags/types';

export type BlockPathEntry =
  | { type: 'block'; id: string }
  | { type: 'cond'; id: string; branch: 'then' | 'else' };

export type BlockPath = BlockPathEntry[];

export interface AnchorLocation {
  path: BlockPath;
  paragraphIndex: number;
}

export interface RefUsage {
  target: string;
  path: BlockPath;
  paragraphIndex: number;
  raw: string;
}

export interface BlockAnalysis {
  anchors: Map<string, AnchorLocation>;
  refs: RefUsage[];
}

/**
 * Walk a classified document once, recording each anchor's (`{{cl id}}` /
 * `{{pt id}}` / `{{al id}}`) and each `{{ref:id}}`'s block-nesting path — the
 * stack of enclosing `{{#id}}`/`{{#se id}}` blocks (and, for conditionals,
 * which branch) at the point they occur. Used by `findHiddenRefs` below.
 */
export function analyzeBlocks(paragraphs: ClassifiedParagraph[]): BlockAnalysis {
  const anchors = new Map<string, AnchorLocation>();
  const refs: RefUsage[] = [];
  const stack: BlockPathEntry[] = [];

  const snapshot = (): BlockPath => stack.map((e) => ({ ...e }));

  paragraphs.forEach((paragraph, paragraphIndex) => {
    for (const node of paragraph.nodes) {
      if (node.kind !== 'tag') continue;
      const t = node.node;

      if (t.kind === 'cl' || t.kind === 'pt' || t.kind === 'al') {
        if (t.anchor !== undefined && !anchors.has(t.anchor)) {
          anchors.set(t.anchor, { path: snapshot(), paragraphIndex });
        }
      } else if (t.kind === 'ref') {
        refs.push({ target: t.target, path: snapshot(), paragraphIndex, raw: node.raw });
      } else if (t.kind === 'blockOpen') {
        stack.push({ type: 'block', id: t.id });
      } else if (t.kind === 'blockClose') {
        stack.pop();
      } else if (t.kind === 'condOpen') {
        stack.push({ type: 'cond', id: t.id, branch: 'then' });
      } else if (t.kind === 'condElse') {
        const top = stack.at(-1);
        if (top?.type === 'cond') top.branch = 'else';
      } else if (t.kind === 'condClose') {
        stack.pop();
      }
    }
  });

  return { anchors, refs };
}

function isPathEntryEqual(a: BlockPathEntry, b: BlockPathEntry): boolean {
  if (a.type !== b.type || a.id !== b.id) return false;
  return a.type === 'cond' && b.type === 'cond' ? a.branch === b.branch : true;
}

/** True iff every point where `refPath` is reached, `anchorPath`'s blocks were necessarily also open. */
function anchorIsSafeForRef(anchorPath: BlockPath, refPath: BlockPath): boolean {
  if (anchorPath.length > refPath.length) return false;
  return anchorPath.every((entry, i) => isPathEntryEqual(entry, refPath[i] as BlockPathEntry));
}

/**
 * REF_TARGET_HIDDEN (SPEC.md §3-4): a `{{ref:id}}` whose target anchor lives
 * inside a block/condition the ref itself isn't also (at least as deeply)
 * nested in — so the anchor could be hidden while the ref renders.
 * Only checks refs whose target anchor exists (REF_UNKNOWN is M1's job).
 */
export function findHiddenRefs(analysis: BlockAnalysis): TagError[] {
  const errors: TagError[] = [];
  for (const ref of analysis.refs) {
    const anchor = analysis.anchors.get(ref.target);
    if (!anchor) continue;
    if (!anchorIsSafeForRef(anchor.path, ref.path)) {
      errors.push({
        code: 'REF_TARGET_HIDDEN',
        message: `"{{ref:${ref.target}}}" may render while its target anchor "${ref.target}" is hidden.`,
        paragraphIndex: ref.paragraphIndex,
        raw: ref.raw,
      });
    }
  }
  return errors;
}
