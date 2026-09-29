import { childElements, firstElementChild, W_NS } from './ooxml';
import type { ParagraphLocation } from '../tags/types';

export interface DocxRun {
  element: Element;
  rPr: Element | null;
  text: string;
  /** Character offset range of this run's text within the paragraph's concatenated text. */
  start: number;
  end: number;
}

export interface DocxParagraph {
  element: Element;
  location: ParagraphLocation;
  runs: DocxRun[];
  text: string;
}

function runText(runEl: Element): string {
  let text = '';
  for (const el of childElements(runEl)) {
    if (el.namespaceURI !== W_NS) continue;
    if (el.localName === 't') {
      text += el.textContent ?? '';
    } else if (el.localName === 'tab') {
      text += '\t';
    } else if (el.localName === 'br' || el.localName === 'cr') {
      text += '\n';
    }
  }
  return text;
}

function buildParagraph(pEl: Element, location: ParagraphLocation): DocxParagraph {
  const runs: DocxRun[] = [];
  let offset = 0;
  for (const runEl of childElements(pEl, 'r')) {
    const text = runText(runEl);
    const start = offset;
    offset += text.length;
    runs.push({ element: runEl, rPr: firstElementChild(runEl, 'rPr'), text, start, end: offset });
  }
  return { element: pEl, location, runs, text: runs.map((r) => r.text).join('') };
}

/** All `<w:p>` paragraphs under `root`, including ones nested in table cells. */
export function findParagraphs(root: Element, location: ParagraphLocation): DocxParagraph[] {
  const pElements = root.getElementsByTagNameNS(W_NS, 'p');
  return Array.from(pElements).map((p) => buildParagraph(p, location));
}
