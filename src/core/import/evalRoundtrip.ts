// M8 eval: measure how well the blank importer recovers the dynamic inputs of an
// already-tagged template. The tagged template is "blanked" (every value tag
// becomes a labelled `[Label]` blank, the way a human would write a minuta),
// re-imported, and the regenerated tags are compared occurrence by occurrence.
import { readDocx, toRawParagraphs } from '../docx/read';
import { rezip } from '../docx/build';
import { replaceTagsInParagraph } from '../docx/replace';
import type { TagReplacement } from '../docx/replace';
import { classifyTag } from '../tags/classify';
import { parseTemplate } from '../tags/parse';
import { findTagSpans } from '../tags/tokenize';
import type { TagModifier, TagType } from '../tags/types';
import { detectBlanks } from './detect';
import { generateTemplate } from './generate';
import { inferFields } from './infer';
import type { InferredField } from './infer';

export interface Occurrence {
  paraIndex: number;
  id: string;
  type: TagType;
  modifier?: TagModifier;
}

export interface RoundtripMiss {
  expected: Occurrence;
  actual: Occurrence | null;
  reason: string;
}

export interface RoundtripReport {
  total: number;
  correct: number;
  misses: RoundtripMiss[];
  /** Fields proposed by the importer (for inspecting ids/groups/options). */
  fields: InferredField[];
  lintProblems: string[];
}

function occurrencesOf(bytes: Uint8Array): Occurrence[] {
  const doc = readDocx(bytes);
  const { paragraphs } = parseTemplate(toRawParagraphs(doc));
  const out: Occurrence[] = [];
  paragraphs.forEach((p, paraIndex) => {
    if (p.location !== 'body') return;
    for (const n of p.nodes) {
      if (n.kind === 'tag' && n.node.kind === 'value') {
        out.push({ paraIndex, id: n.node.id, type: n.node.type, ...(n.node.modifier && { modifier: n.node.modifier }) });
      }
    }
  });
  return out;
}

/** Replace every value tag with `[Label]` (`[Label por extenso]` for the extenso modifier). */
export function blankTemplate(bytes: Uint8Array, labelFor: (id: string) => string): Uint8Array {
  const doc = readDocx(bytes);
  for (const paragraph of doc.paragraphs) {
    const replacements: TagReplacement[] = [];
    for (const span of findTagSpans(paragraph.text)) {
      const { node } = classifyTag(span.raw);
      if (node.kind !== 'value') continue;
      const suffix = node.modifier === 'extenso' ? ' por extenso' : '';
      replacements.push({ start: span.start, end: span.end, value: `[${labelFor(node.id)}${suffix}]` });
    }
    replaceTagsInParagraph(paragraph, replacements);
  }
  return rezip(doc.archive, doc.documentXmlDoc);
}

export function runRoundtrip(templateBytes: Uint8Array, labelFor: (id: string) => string): RoundtripReport {
  const expected = occurrencesOf(templateBytes);
  const blanked = blankTemplate(templateBytes, labelFor);

  const doc = readDocx(blanked);
  const { blanks } = detectBlanks(doc.paragraphs.map((p) => p.text));
  const inferred = inferFields(blanks);
  const result = generateTemplate({ bytes: blanked, ...inferred, title: 'eval', templateId: 'eval' });
  const lintProblems = result.problems.map((p) => `${p.code}: ${p.message}`);
  if (!result.docxBytes) {
    return { total: expected.length, correct: 0, misses: [], fields: inferred.fields, lintProblems };
  }

  const actual = occurrencesOf(result.docxBytes);
  const misses: RoundtripMiss[] = [];

  // id partition: each original id must map to exactly one generated id, and back.
  const fwd = new Map<string, Set<string>>();
  const back = new Map<string, Set<string>>();
  expected.forEach((e, i) => {
    const a = actual[i];
    if (!a) return;
    (fwd.get(e.id) ?? fwd.set(e.id, new Set()).get(e.id))?.add(a.id);
    (back.get(a.id) ?? back.set(a.id, new Set()).get(a.id))?.add(e.id);
  });

  let correct = 0;
  expected.forEach((e, i) => {
    const a = actual[i] ?? null;
    if (!a || a.paraIndex !== e.paraIndex) {
      misses.push({ expected: e, actual: a, reason: 'no matching tag at this position' });
    } else if (a.type !== e.type) {
      misses.push({ expected: e, actual: a, reason: `type ${e.type} -> ${a.type}` });
    } else if ((a.modifier ?? null) !== (e.modifier ?? null)) {
      misses.push({ expected: e, actual: a, reason: `modifier ${e.modifier ?? '-'} -> ${a.modifier ?? '-'}` });
    } else if ((fwd.get(e.id)?.size ?? 0) > 1) {
      misses.push({ expected: e, actual: a, reason: `id split: ${e.id} -> ${Array.from(fwd.get(e.id) ?? []).join(',')}` });
    } else if ((back.get(a.id)?.size ?? 0) > 1) {
      misses.push({ expected: e, actual: a, reason: `id merged: ${Array.from(back.get(a.id) ?? []).join(',')} -> ${a.id}` });
    } else {
      correct += 1;
    }
  });

  return { total: expected.length, correct, misses, fields: inferred.fields, lintProblems };
}
