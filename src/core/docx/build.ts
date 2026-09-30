import { zipSync } from 'fflate';
import { W_NS } from './ooxml';
import { replaceTagsInParagraph } from './replace';
import type { DocxDocument } from './read';
import { resolveNumbering } from '../numbering/resolve';
import type { BlockValues } from '../numbering/resolve';
import { eurosToWords, numberToWords } from '../validators/extenso';
import { formatEurPt, parseEurPt } from '../formats/eur';
import { parseIntPt } from '../formats/int';
import { parseTemplate } from '../tags/parse';
import { findEscapeSpans, findTagSpans } from '../tags/tokenize';
import type { ParagraphNode, RawParagraph, TagModifier, TagType } from '../tags/types';
import type { TagReplacement } from './replace';

export interface ShadingOptions {
  activeFieldId?: string;
}

// Warm highlighter-pen family, on brand with the app chrome's brass accent
// (src/index.css --brass-*) — distinct enough from each other to read at a
// glance: bright yellow (needs input) > warm gold (editing now) > faint tint (filled).
const SHADE_EMPTY = 'FFF59D';
const SHADE_FILLED = 'F4F1E9';
const SHADE_ACTIVE = 'F2C879';

function renderValue(raw: string, type: TagType, modifier: TagModifier | undefined): string {
  if (!raw) return '';
  if (modifier === 'extenso') {
    if (type === 'eur') {
      const cents = parseEurPt(raw);
      return cents === null ? raw : eurosToWords(cents);
    }
    if (type === 'int') {
      const n = parseIntPt(raw);
      return n === null ? raw : numberToWords(n);
    }
    return raw;
  }
  const base = type === 'eur' ? ((c) => (c === null ? raw : formatEurPt(c)))(parseEurPt(raw)) : raw;
  return modifier === 'upper' ? base.toLocaleUpperCase('pt-PT') : base;
}

/** Per-paragraph replacement plan: zips findTagSpans (span order) with the classified nodes (node order) — both come from the same left-to-right scan, so the k-th tag span is the k-th tag node. */
function buildParagraphReplacements(
  paragraphIndex: number,
  text: string,
  nodes: readonly ParagraphNode[],
  numbering: ReturnType<typeof resolveNumbering>,
  values: Readonly<Record<string, string>>,
  shading: ShadingOptions | undefined,
): TagReplacement[] {
  const replacements: TagReplacement[] = findEscapeSpans(text).map((e) => ({ start: e.start, end: e.end, value: '{{' }));

  const spans = findTagSpans(text);
  let spanIndex = 0;
  nodes.forEach((node, nodeIndex) => {
    if (node.kind !== 'tag') return;
    const span = spans[spanIndex];
    spanIndex += 1;
    if (!span) return;
    const key = `${paragraphIndex}:${nodeIndex}`;
    const t = node.node;
    if (t.kind === 'value') {
      const raw = values[t.id] ?? '';
      if (shading) {
        const isEmpty = raw.length === 0;
        const text_ = isEmpty ? `[${t.id}]` : renderValue(raw, t.type, t.modifier);
        const shadeFill = isEmpty ? SHADE_EMPTY : t.id === shading.activeFieldId ? SHADE_ACTIVE : SHADE_FILLED;
        replacements.push({ start: span.start, end: span.end, value: text_, shadeFill });
      } else {
        replacements.push({ start: span.start, end: span.end, value: renderValue(raw, t.type, t.modifier) });
      }
    } else if (t.kind === 'cl' || t.kind === 'pt' || t.kind === 'al') {
      replacements.push({ start: span.start, end: span.end, value: numbering.markerText.get(key) ?? '' });
    } else if (t.kind === 'ref') {
      replacements.push({ start: span.start, end: span.end, value: numbering.refText.get(key) ?? '' });
    } else {
      // blockOpen/blockClose/condOpen/condElse/condClose: the whole paragraph is removed
      // (handled by the caller via numbering.visible), nothing to substitute inline.
      replacements.push({ start: span.start, end: span.end, value: '' });
    }
  });

  return replacements.sort((a, b) => a.start - b.start);
}

function appendDisclaimerParagraph(documentXmlDoc: Document, text: string): void {
  const body = documentXmlDoc.getElementsByTagNameNS(W_NS, 'body')[0];
  if (!body || !text) return;
  const p = documentXmlDoc.createElementNS(W_NS, 'w:p');
  const r = documentXmlDoc.createElementNS(W_NS, 'w:r');
  const t = documentXmlDoc.createElementNS(W_NS, 'w:t');
  t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
  t.appendChild(documentXmlDoc.createTextNode(text));
  r.appendChild(t);
  p.appendChild(r);
  // Insert before any trailing sectPr (section properties must stay the body's last child).
  const sectPr = body.getElementsByTagNameNS(W_NS, 'sectPr')[0];
  if (sectPr && sectPr.parentNode === body) {
    body.insertBefore(p, sectPr);
  } else {
    body.appendChild(p);
  }
}

function rezip(archive: ReadonlyMap<string, Uint8Array>, documentXmlDoc: Document): Uint8Array {
  const serialized = new XMLSerializer().serializeToString(documentXmlDoc);
  const files: Record<string, Uint8Array> = {};
  for (const [name, data] of archive) {
    files[name] = name === 'word/document.xml' ? new TextEncoder().encode(serialized) : data;
  }
  return zipSync(files, { level: 6 });
}

export interface BuildDocxInput {
  doc: DocxDocument;
  values: Readonly<Record<string, string>>;
  /** pt-PT disclaimer text, sourced by the caller from src/ui/messages.pt.ts (src/core stays string-free). */
  disclaimerText: string;
  /** pt-PT "RASCUNHO" note, appended only for draft downloads (SPEC.md §8). Omit for final/preview. */
  draftNote?: string;
  /**
   * Preview/draft-only highlighting (SPEC.md §7): empty value tags render as
   * "[id]" shaded yellow, filled ones get a soft tint, `activeFieldId`'s a
   * stronger one. Omit entirely for the final download — its bytes must be
   * clean, never shaded (this is what keeps final === preview's *text*, per
   * SPEC.md §8's single-source-of-truth, while differing only in formatting).
   */
  shading?: ShadingOptions;
}

/**
 * Single source of truth for the rendered document (SPEC.md §8): applies
 * value formatting, cl/pt/al/ref numbering, block visibility (hidden blocks'
 * paragraphs — including their own marker paragraph — are removed), and
 * appends the disclaimer. Preview and download both consume these same bytes.
 */
export function buildDocx(input: BuildDocxInput): Uint8Array {
  const { doc, values, disclaimerText, draftNote, shading } = input;

  const rawBodyParagraphs: RawParagraph[] = doc.paragraphs.map((p) => ({ location: 'body', text: p.text }));
  const { paragraphs: classified } = parseTemplate(rawBodyParagraphs);

  const blockValuesBuilder: Record<string, boolean> = {};
  for (const paragraph of classified) {
    for (const node of paragraph.nodes) {
      if (node.kind === 'tag' && (node.node.kind === 'blockOpen' || node.node.kind === 'condOpen')) {
        blockValuesBuilder[node.node.id] = Boolean(values[node.node.id]);
      }
    }
  }
  const blockValues: BlockValues = blockValuesBuilder;

  const numbering = resolveNumbering(classified, blockValues);

  doc.paragraphs.forEach((docxParagraph, i) => {
    if (!numbering.visible[i]) {
      docxParagraph.element.parentNode?.removeChild(docxParagraph.element);
      return;
    }
    const classifiedParagraph = classified[i];
    if (!classifiedParagraph) return;
    const replacements = buildParagraphReplacements(i, docxParagraph.text, classifiedParagraph.nodes, numbering, values, shading);
    replaceTagsInParagraph(docxParagraph, replacements);
  });

  appendDisclaimerParagraph(doc.documentXmlDoc, disclaimerText);
  if (draftNote) appendDisclaimerParagraph(doc.documentXmlDoc, draftNote);

  return rezip(doc.archive, doc.documentXmlDoc);
}
