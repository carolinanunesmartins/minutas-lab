import { DocxInputError, readDocxArchive } from './zip';
import type { DocxArchive } from './zip';
import { findParagraphs, type DocxParagraph } from './runmap';
import { W_NS } from './ooxml';
import type { ParagraphLocation, RawParagraph } from '../tags/types';

const DOCUMENT_XML_PATH = 'word/document.xml';
const HEADER_FOOTER_PATTERN = /^word\/(header|footer)\d*\.xml$/;

export interface DocxHeaderFooterParagraph {
  location: 'header' | 'footer';
  text: string;
}

export interface DocxDocument {
  archive: DocxArchive;
  documentXmlDoc: Document;
  /** Body paragraphs (incl. table cells) with full run-maps, ready for T1.3 span replacement. */
  paragraphs: DocxParagraph[];
  /** Header/footer paragraphs: text only — tags are not supported there (TAG_UNSUPPORTED_LOCATION). */
  headerFooterParagraphs: DocxHeaderFooterParagraph[];
}

function parseXml(bytes: Uint8Array): Document {
  const text = new TextDecoder('utf-8').decode(bytes);
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new DocxInputError('MALFORMED_XML', `Malformed XML: ${parserError.textContent ?? ''}`);
  }
  return doc;
}

/** Bounded-read a .docx and extract its body run-maps and header/footer text. */
export function readDocx(bytes: Uint8Array): DocxDocument {
  const archive = readDocxArchive(bytes);

  const documentXmlBytes = archive.get(DOCUMENT_XML_PATH);
  if (!documentXmlBytes) {
    throw new DocxInputError('MISSING_DOCUMENT_XML', `Archive has no ${DOCUMENT_XML_PATH}.`);
  }
  const documentXmlDoc = parseXml(documentXmlBytes);
  const body = documentXmlDoc.getElementsByTagNameNS(W_NS, 'body')[0];
  if (!body) {
    throw new DocxInputError('MISSING_DOCUMENT_XML', 'word/document.xml has no <w:body>.');
  }

  const paragraphs = findParagraphs(body, 'body');

  const headerFooterParagraphs: DocxHeaderFooterParagraph[] = [];
  for (const [name, data] of archive) {
    const match = HEADER_FOOTER_PATTERN.exec(name);
    if (!match) continue;
    const location = match[1] as 'header' | 'footer';
    const doc = parseXml(data);
    const root = doc.documentElement;
    for (const p of findParagraphs(root, location satisfies ParagraphLocation)) {
      headerFooterParagraphs.push({ location, text: p.text });
    }
  }

  return { archive, documentXmlDoc, paragraphs, headerFooterParagraphs };
}

/** Flatten a read DocxDocument into the RawParagraph[] shape the tag parser (T1.2) consumes. */
export function toRawParagraphs(doc: DocxDocument): RawParagraph[] {
  return [
    ...doc.paragraphs.map((p) => ({ location: p.location, text: p.text })),
    ...doc.headerFooterParagraphs,
  ];
}

export { DocxInputError } from './zip';
export type { DocxInputErrorCode, DocxArchive } from './zip';
export type { DocxParagraph, DocxRun } from './runmap';
