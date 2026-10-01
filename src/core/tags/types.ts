// REQ-TAG (SPEC.md §3)

export const TAG_TYPES = ['text', 'nif', 'nipc', 'iban', 'cc', 'data', 'eur', 'int'] as const;
export type TagType = (typeof TAG_TYPES)[number];

export const TAG_MODIFIERS = ['extenso', 'upper'] as const;
export type TagModifier = (typeof TAG_MODIFIERS)[number];

export const TAG_ERROR_CODES = [
  'TAG_SYNTAX',
  'TAG_UNKNOWN_TYPE',
  'TAG_TYPE_CONFLICT',
  'TAG_BLOCK_UNCLOSED',
  'TAG_BLOCK_MISMATCH',
  'TAG_BLOCK_NOT_ALONE',
  'TAG_MODIFIER_INVALID',
  'REF_UNKNOWN',
  'ANCHOR_DUPLICATE',
  'REF_TARGET_HIDDEN',
  'META_UNKNOWN_FIELD',
  'TAG_UNSUPPORTED_LOCATION',
] as const;
export type TagErrorCode = (typeof TAG_ERROR_CODES)[number];

export type ParagraphLocation = 'body' | 'header' | 'footer';

export interface TagError {
  code: TagErrorCode;
  message: string;
  paragraphIndex: number;
  raw?: string;
}

/** Lexer-level token: a run of literal text, or a `{{...}}` tag's raw inner content. */
export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'tag'; raw: string };

export interface RawParagraph {
  location: ParagraphLocation;
  text: string;
}

export interface TokenizedParagraph {
  location: ParagraphLocation;
  tokens: InlineToken[];
}

/** Classified tag node kinds, produced from a tag token's raw content. */
export type TagNode =
  | { kind: 'value'; id: string; type: TagType; explicitType: boolean; modifier?: TagModifier }
  | { kind: 'blockOpen'; id: string }
  | { kind: 'blockClose'; id: string }
  | { kind: 'condOpen'; id: string }
  | { kind: 'condElse' }
  | { kind: 'condClose' }
  | { kind: 'cl'; anchor?: string }
  | { kind: 'pt'; anchor?: string }
  | { kind: 'al'; anchor?: string }
  | { kind: 'ref'; target: string }
  | { kind: 'invalid' };

export type ParagraphNode =
  | { kind: 'text'; text: string }
  | { kind: 'tag'; raw: string; node: TagNode };

export interface ClassifiedParagraph {
  location: ParagraphLocation;
  nodes: ParagraphNode[];
}

export interface ParseResult {
  paragraphs: ClassifiedParagraph[];
  errors: TagError[];
}

export const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

/** Ids that would resolve to Object.prototype members when used as `values[id]`. */
export const RESERVED_IDS: ReadonlySet<string> = new Set(['constructor', 'prototype', 'valueof', 'tostring']);
export const isValidFieldId = (id: string): boolean => ID_PATTERN.test(id) && !RESERVED_IDS.has(id) && !(id in Object.prototype);
