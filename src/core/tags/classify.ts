import { ID_PATTERN, TAG_MODIFIERS, TAG_TYPES, isValidFieldId } from './types';
import type { TagErrorCode, TagModifier, TagNode, TagType } from './types';

const REF = /^ref:([a-z][a-z0-9_]*)$/;
const COND_OPEN = /^#se\s+([a-z][a-z0-9_]*)$/;
const COND_ELSE = /^#senao$/;
const COND_CLOSE = /^\/se$/;
const BLOCK_OPEN = /^#([a-z][a-z0-9_]*)$/;
const BLOCK_CLOSE = /^\/([a-z][a-z0-9_]*)$/;
const NUMBERING = /^(cl|pt|al)(?:\s+([a-z][a-z0-9_]*))?$/;
const VALUE = /^([a-z][a-z0-9_]*)(?::([a-z]+))?(?:\|([a-z]+))?$/;

export interface ClassifyIssue {
  code: TagErrorCode;
  message: string;
}

export interface ClassifyResult {
  node: TagNode;
  issues: ClassifyIssue[];
}

function isTagType(value: string): value is TagType {
  return (TAG_TYPES as readonly string[]).includes(value);
}

function isTagModifier(value: string): value is TagModifier {
  return (TAG_MODIFIERS as readonly string[]).includes(value);
}

/** Classify one `{{...}}` tag's trimmed raw inner content per SPEC.md §3. */
function classifyTagUnchecked(raw: string): ClassifyResult {
  let m: RegExpExecArray | null;

  if ((m = REF.exec(raw))) {
    return { node: { kind: 'ref', target: m[1] as string }, issues: [] };
  }

  if (COND_ELSE.exec(raw)) {
    return { node: { kind: 'condElse' }, issues: [] };
  }

  if (COND_CLOSE.exec(raw)) {
    return { node: { kind: 'condClose' }, issues: [] };
  }

  if ((m = COND_OPEN.exec(raw))) {
    return { node: { kind: 'condOpen', id: m[1] as string }, issues: [] };
  }

  if ((m = BLOCK_CLOSE.exec(raw))) {
    // "/se" is always intercepted by COND_CLOSE above, so "se" can't reach here.
    return { node: { kind: 'blockClose', id: m[1] as string }, issues: [] };
  }

  if ((m = BLOCK_OPEN.exec(raw))) {
    const id = m[1] as string;
    if (id === 'se') {
      return {
        node: { kind: 'invalid' },
        issues: [
          {
            code: 'TAG_SYNTAX',
            message: '"{{#se}}" must be followed by a condition id, e.g. "{{#se onus}}".',
          },
        ],
      };
    }
    return { node: { kind: 'blockOpen', id }, issues: [] };
  }

  if ((m = NUMBERING.exec(raw))) {
    const kind = m[1] as 'cl' | 'pt' | 'al';
    const anchor = m[2];
    return { node: anchor === undefined ? { kind } : { kind, anchor }, issues: [] };
  }

  if ((m = VALUE.exec(raw))) {
    const id = m[1] as string;
    const typeRaw = m[2];
    const modifierRaw = m[3];
    const issues: ClassifyIssue[] = [];

    let type: TagType = 'text';
    const explicitType = typeRaw !== undefined;
    if (typeRaw !== undefined) {
      if (isTagType(typeRaw)) {
        type = typeRaw;
      } else {
        issues.push({ code: 'TAG_UNKNOWN_TYPE', message: `Unknown tag type "${typeRaw}" in "{{${raw}}}".` });
      }
    }

    let modifier: TagModifier | undefined;
    if (modifierRaw !== undefined) {
      if (!isTagModifier(modifierRaw)) {
        issues.push({
          code: 'TAG_MODIFIER_INVALID',
          message: `Unknown modifier "${modifierRaw}" in "{{${raw}}}".`,
        });
      } else if (modifierRaw === 'extenso' && type !== 'eur' && type !== 'int') {
        issues.push({
          code: 'TAG_MODIFIER_INVALID',
          message: `Modifier "extenso" only applies to "eur"/"int" tags, not "{{${raw}}}".`,
        });
      } else {
        modifier = modifierRaw;
      }
    }

    const node: TagNode =
      modifier === undefined
        ? { kind: 'value', id, type, explicitType }
        : { kind: 'value', id, type, explicitType, modifier };
    return { node, issues };
  }

  return {
    node: { kind: 'invalid' },
    issues: [{ code: 'TAG_SYNTAX', message: `Malformed tag: "{{${raw}}}"` }],
  };
}

/** Rejects ids that would resolve to Object.prototype members when looked up in a values map. */
export function classifyTag(raw: string): ClassifyResult {
  const result = classifyTagUnchecked(raw);
  const node = result.node;
  if ('id' in node && !isValidFieldId(node.id)) {
    return { node: { kind: 'invalid' }, issues: [{ code: 'TAG_SYNTAX', message: `Reserved field id: "${node.id}"` }] };
  }
  return result;
}

export { ID_PATTERN };
