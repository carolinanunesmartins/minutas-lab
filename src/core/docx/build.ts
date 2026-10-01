import { zipSync } from 'fflate';
import { W_NS } from './ooxml';
import { replaceTagsInParagraph } from './replace';
import type { DocxDocument } from './read';
import { isBlockMarkerParagraph, resolveNumbering } from '../numbering/resolve';
import type { BlockValues } from '../numbering/resolve';
import { eurosToWords, numberToWords } from '../validators/extenso';
import { formatEurPt, parseEurPt } from '../formats/eur';
import { parseIntPt } from '../formats/int';
import { parseTemplate } from '../tags/parse';
import { findEscapeSpans, findTagSpans } from '../tags/tokenize';
import type { ClassifiedParagraph, ParagraphNode, RawParagraph, TagModifier, TagType } from '../tags/types';
import type { AnchorOptions, TagReplacement } from './replace';

export interface ShadingOptions {
  activeFieldId?: string;
  /**
   * Live-preview only: wrap each value run in a `fld_<id>_<n>` bookmark so the
   * UI can map preview text <-> form input. Never set for draft/final downloads.
   */
  anchors?: boolean;
}

/** Bookmark-name prefix the preview UI looks for (`fld_<fieldId>_<occurrence>`). */
export const FIELD_ANCHOR_PREFIX = 'fld_';
/** Bookmark-name prefix for a conditional block's first visible paragraph (`blk_<blockId>`). */
export const BLOCK_ANCHOR_PREFIX = 'blk_';

/**
 * For each `{{#id}}` / `{{#se id}}` block: the paragraph a preview should jump
 * to when that toggle changes — its first visible paragraph (either branch), or,
 * when the whole block is currently hidden, the first visible paragraph after
 * where it sat, so switching it off still shows where the clause disappeared.
 */
function computeBlockAnchorTargets(paragraphs: ClassifiedParagraph[], visible: boolean[]): Map<number, string[]> {
  const stack: string[] = [];
  const openIndex = new Map<string, number>();
  const contentIndices = new Map<string, number[]>();
  paragraphs.forEach((paragraph, i) => {
    const marker = isBlockMarkerParagraph(paragraph);
    if (marker) {
      if (marker.kind === 'blockOpen' || marker.kind === 'condOpen') {
        stack.push(marker.id);
        if (!openIndex.has(marker.id)) openIndex.set(marker.id, i);
      } else if (marker.kind === 'blockClose' || marker.kind === 'condClose') {
        stack.pop();
      }
      return;
    }
    for (const id of stack) contentIndices.set(id, [...(contentIndices.get(id) ?? []), i]);
  });

  const targets = new Map<number, string[]>();
  for (const [id, open] of openIndex) {
    let target = (contentIndices.get(id) ?? []).find((i) => visible[i]);
    if (target === undefined) target = visible.findIndex((v, i) => i > open && v);
    if (target !== undefined && target >= 0) targets.set(target, [...(targets.get(target) ?? []), id]);
  }
  return targets;
}

function insertParagraphBookmarks(paragraph: Element, entries: { id: number; name: string }[]): void {
  const doc = paragraph.ownerDocument;
  const first = Array.from(paragraph.childNodes).find((n) => !(n.nodeType === 1 && (n as Element).localName === 'pPr')) ?? null;
  for (const { id, name } of entries) {
    const start = doc.createElementNS(W_NS, 'w:bookmarkStart');
    start.setAttributeNS(W_NS, 'w:id', String(id));
    start.setAttributeNS(W_NS, 'w:name', name);
    const end = doc.createElementNS(W_NS, 'w:bookmarkEnd');
    end.setAttributeNS(W_NS, 'w:id', String(id));
    paragraph.insertBefore(start, first);
    paragraph.insertBefore(end, first);
  }
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
        replacements.push({ start: span.start, end: span.end, value: text_, shadeFill, fieldId: t.id });
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

export function rezip(archive: ReadonlyMap<string, Uint8Array>, documentXmlDoc: Document): Uint8Array {
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

  let anchorOptions: AnchorOptions | undefined;
  if (shading?.anchors) {
    // Start above any bookmark ids the template already uses.
    let maxId = 0;
    for (const el of Array.from(doc.documentXmlDoc.getElementsByTagNameNS(W_NS, 'bookmarkStart'))) {
      maxId = Math.max(maxId, Number(el.getAttributeNS(W_NS, 'id')) || 0);
    }
    let nextId = maxId + 1;
    const occurrences = new Map<string, number>();
    anchorOptions = {
      nextBookmarkId: () => nextId++,
      nameFor: (fieldId) => {
        const n = occurrences.get(fieldId) ?? 0;
        occurrences.set(fieldId, n + 1);
        return `${FIELD_ANCHOR_PREFIX}${fieldId}_${n}`;
      },
    };
  }

  const blockAnchorTargets = anchorOptions ? computeBlockAnchorTargets(classified, numbering.visible) : undefined;

  doc.paragraphs.forEach((docxParagraph, i) => {
    if (!numbering.visible[i]) {
      docxParagraph.element.parentNode?.removeChild(docxParagraph.element);
      return;
    }
    const classifiedParagraph = classified[i];
    if (!classifiedParagraph) return;
    const replacements = buildParagraphReplacements(i, docxParagraph.text, classifiedParagraph.nodes, numbering, values, shading);
    replaceTagsInParagraph(docxParagraph, replacements, anchorOptions);
    const blockIds = blockAnchorTargets?.get(i);
    if (anchorOptions && blockIds) {
      insertParagraphBookmarks(
        docxParagraph.element,
        blockIds.map((id) => ({ id: anchorOptions.nextBookmarkId(), name: `${BLOCK_ANCHOR_PREFIX}${id}` })),
      );
    }
  });

  appendDisclaimerParagraph(doc.documentXmlDoc, disclaimerText);
  if (draftNote) appendDisclaimerParagraph(doc.documentXmlDoc, draftNote);

  return rezip(doc.archive, doc.documentXmlDoc);
}
