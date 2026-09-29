import { classifyTag } from './classify';
import type {
  ClassifiedParagraph,
  ParagraphNode,
  ParseResult,
  TagError,
  TagNode,
  TokenizedParagraph,
} from './types';

type StackEntry =
  | { kind: 'block'; id: string; paragraphIndex: number }
  | { kind: 'cond'; id: string; hasElse: boolean; paragraphIndex: number };

function isBlockish(node: TagNode): boolean {
  return (
    node.kind === 'blockOpen' ||
    node.kind === 'blockClose' ||
    node.kind === 'condOpen' ||
    node.kind === 'condElse' ||
    node.kind === 'condClose'
  );
}

/** Classify + structurally validate a tokenized document (all paragraphs, in document order). */
export function validateDocument(paragraphs: TokenizedParagraph[]): ParseResult {
  const errors: TagError[] = [];
  const classified: ClassifiedParagraph[] = [];
  const stack: StackEntry[] = [];
  const anchors = new Map<string, number>();
  const refs: { target: string; paragraphIndex: number }[] = [];
  const valueTypes = new Map<string, string>();

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const nodes: ParagraphNode[] = [];
    const blockishInParagraph: TagNode[] = [];
    let hasNonBlockContent = false;

    for (const token of paragraph.tokens) {
      if (token.kind === 'text') {
        nodes.push({ kind: 'text', text: token.text });
        if (token.text.trim().length > 0) hasNonBlockContent = true;
        continue;
      }

      const { node, issues } = classifyTag(token.raw);
      nodes.push({ kind: 'tag', raw: token.raw, node });
      for (const issue of issues) {
        errors.push({ ...issue, paragraphIndex, raw: token.raw });
      }

      if (paragraph.location !== 'body') {
        errors.push({
          code: 'TAG_UNSUPPORTED_LOCATION',
          message: `Tags are not allowed in ${paragraph.location}s: "{{${token.raw}}}".`,
          paragraphIndex,
          raw: token.raw,
        });
      }

      if (isBlockish(node)) {
        blockishInParagraph.push(node);
      } else {
        hasNonBlockContent = true;
      }

      if (node.kind === 'cl' || node.kind === 'pt' || node.kind === 'al') {
        if (node.anchor !== undefined) {
          if (anchors.has(node.anchor)) {
            errors.push({
              code: 'ANCHOR_DUPLICATE',
              message: `Anchor "${node.anchor}" is declared more than once.`,
              paragraphIndex,
              raw: token.raw,
            });
          } else {
            anchors.set(node.anchor, paragraphIndex);
          }
        }
      } else if (node.kind === 'ref') {
        refs.push({ target: node.target, paragraphIndex });
      } else if (node.kind === 'value') {
        const previous = valueTypes.get(node.id);
        if (previous === undefined) {
          valueTypes.set(node.id, node.type);
        } else if (previous !== node.type) {
          errors.push({
            code: 'TAG_TYPE_CONFLICT',
            message: `Tag "${node.id}" was previously used with type "${previous}", now "${node.type}".`,
            paragraphIndex,
            raw: token.raw,
          });
        }
      } else if (node.kind === 'blockOpen') {
        stack.push({ kind: 'block', id: node.id, paragraphIndex });
      } else if (node.kind === 'blockClose') {
        const top = stack.at(-1);
        if (top === undefined || top.kind !== 'block' || top.id !== node.id) {
          errors.push({
            code: 'TAG_BLOCK_MISMATCH',
            message: `Unexpected "{{/${node.id}}}" — no matching open block.`,
            paragraphIndex,
            raw: token.raw,
          });
        } else {
          stack.pop();
        }
      } else if (node.kind === 'condOpen') {
        stack.push({ kind: 'cond', id: node.id, hasElse: false, paragraphIndex });
      } else if (node.kind === 'condElse') {
        const top = stack.at(-1);
        if (top === undefined || top.kind !== 'cond') {
          errors.push({
            code: 'TAG_BLOCK_MISMATCH',
            message: 'Unexpected "{{#senao}}" — not inside a "{{#se ...}}" block.',
            paragraphIndex,
            raw: token.raw,
          });
        } else if (top.hasElse) {
          errors.push({
            code: 'TAG_BLOCK_MISMATCH',
            message: 'Duplicate "{{#senao}}" in the same "{{#se ...}}" block.',
            paragraphIndex,
            raw: token.raw,
          });
        } else {
          top.hasElse = true;
        }
      } else if (node.kind === 'condClose') {
        const top = stack.at(-1);
        if (top === undefined || top.kind !== 'cond') {
          errors.push({
            code: 'TAG_BLOCK_MISMATCH',
            message: 'Unexpected "{{/se}}" — no matching open "{{#se ...}}" block.',
            paragraphIndex,
            raw: token.raw,
          });
        } else {
          stack.pop();
        }
      }
    }

    if (blockishInParagraph.length > 0 && (hasNonBlockContent || blockishInParagraph.length > 1)) {
      errors.push({
        code: 'TAG_BLOCK_NOT_ALONE',
        message: 'Block tags must be alone in their paragraph.',
        paragraphIndex,
      });
    }

    classified.push({ location: paragraph.location, nodes });
  });

  for (const entry of stack) {
    const label = entry.kind === 'block' ? `{{#${entry.id}}}` : `{{#se ${entry.id}}}`;
    errors.push({
      code: 'TAG_BLOCK_UNCLOSED',
      message: `Block "${label}" is never closed.`,
      paragraphIndex: entry.paragraphIndex,
    });
  }

  for (const ref of refs) {
    if (!anchors.has(ref.target)) {
      errors.push({
        code: 'REF_UNKNOWN',
        message: `"{{ref:${ref.target}}}" has no matching anchor.`,
        paragraphIndex: ref.paragraphIndex,
      });
    }
  }

  return { paragraphs: classified, errors };
}
