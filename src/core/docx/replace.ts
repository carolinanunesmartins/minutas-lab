import { W_NS } from './ooxml';
import type { DocxParagraph } from './runmap';
import { classifyTag } from '../tags/classify';
import { findEscapeSpans, findTagSpans } from '../tags/tokenize';

const XML_NS = 'http://www.w3.org/XML/1998/namespace';

export interface TagReplacement {
  start: number;
  end: number;
  value: string;
  /** Preview/draft-only highlight: hex fill (e.g. "FFF59D"), applied via w:shd. Never set for final downloads. */
  shadeFill?: string;
}

interface Segment {
  text: string;
  rPr: Element | null;
  shadeFill?: string;
}

function emitRange(paragraph: DocxParagraph, from: number, to: number, out: Segment[]): void {
  if (from >= to) return;
  for (const run of paragraph.runs) {
    const segStart = Math.max(run.start, from);
    const segEnd = Math.min(run.end, to);
    if (segStart < segEnd) {
      out.push({ text: run.text.slice(segStart - run.start, segEnd - run.start), rPr: run.rPr });
    }
  }
}

function firstOverlappingRPr(paragraph: DocxParagraph, start: number, end: number): Element | null {
  for (const run of paragraph.runs) {
    if (run.start < end && run.end > start) return run.rPr;
  }
  return null;
}

function buildRun(doc: Document, text: string, rPr: Element | null, shadeFill: string | undefined): Element {
  const r = doc.createElementNS(W_NS, 'w:r');
  const finalRPr = rPr ? (rPr.cloneNode(true) as Element) : doc.createElementNS(W_NS, 'w:rPr');
  if (shadeFill) {
    const shd = doc.createElementNS(W_NS, 'w:shd');
    shd.setAttributeNS(W_NS, 'w:val', 'clear');
    shd.setAttributeNS(W_NS, 'w:color', 'auto');
    shd.setAttributeNS(W_NS, 'w:fill', shadeFill);
    finalRPr.appendChild(shd);
  }
  if (rPr || shadeFill) r.appendChild(finalRPr);
  const t = doc.createElementNS(W_NS, 'w:t');
  t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
  t.appendChild(doc.createTextNode(text));
  r.appendChild(t);
  return r;
}

/**
 * Replace `paragraph.text` character spans [start, end) with their values,
 * mutating the paragraph's `<w:p>` element in place. Each new run's formatting
 * comes from the *first* original run it overlaps (REQ-TAG). Text is inserted
 * via DOM text nodes, so `&`/`<`/`>` are XML-escaped automatically on
 * serialization (REQ-SEC rule 7) — no manual escaping needed.
 *
 * `replacements` must be sorted by `start` and non-overlapping.
 */
export function replaceTagsInParagraph(paragraph: DocxParagraph, replacements: TagReplacement[]): void {
  if (replacements.length === 0 || paragraph.runs.length === 0) return;

  const doc = paragraph.element.ownerDocument;
  const segments: Segment[] = [];
  let pos = 0;
  for (const r of replacements) {
    emitRange(paragraph, pos, r.start, segments);
    const rPr = firstOverlappingRPr(paragraph, r.start, r.end);
    segments.push(r.shadeFill ? { text: r.value, rPr, shadeFill: r.shadeFill } : { text: r.value, rPr });
    pos = r.end;
  }
  emitRange(paragraph, pos, paragraph.text.length, segments);

  // Captured before mutating, so it stays valid once the original runs are removed.
  const lastRun = paragraph.runs.at(-1);
  const insertBefore = lastRun ? lastRun.element.nextSibling : null;

  for (const run of paragraph.runs) {
    run.element.parentNode?.removeChild(run.element);
  }
  for (const segment of segments) {
    if (segment.text.length === 0) continue;
    paragraph.element.insertBefore(buildRun(doc, segment.text, segment.rPr, segment.shadeFill), insertBefore);
  }
}

/**
 * Substitute plain value-tag (`{{id[:type][|modifier]}}`) occurrences with
 * `values[id]` (missing ids become an empty string), and unescape `\{{`
 * sequences to literal "{{". Block/numbering/ref tags are left untouched —
 * resolving those needs M3's numbering/rules engine.
 */
export function substituteValueTags(paragraph: DocxParagraph, values: Readonly<Record<string, string>>): void {
  const replacements: TagReplacement[] = [];
  for (const span of findEscapeSpans(paragraph.text)) {
    replacements.push({ start: span.start, end: span.end, value: '{{' });
  }
  for (const span of findTagSpans(paragraph.text)) {
    const { node } = classifyTag(span.raw);
    if (node.kind !== 'value') continue;
    replacements.push({ start: span.start, end: span.end, value: values[node.id] ?? '' });
  }
  replacements.sort((a, b) => a.start - b.start);
  replaceTagsInParagraph(paragraph, replacements);
}
