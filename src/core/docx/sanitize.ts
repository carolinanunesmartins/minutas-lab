// REQ-SEC (SPEC.md §9): an uploaded .docx is untrusted and is both rendered by
// docx-preview and offered back for download. Neutralise what a hostile file
// could use: external relationships (remote templates, OLE links, hyperlinks
// with odd schemes) and style/font names that docx-preview copies into CSS.
import { DocxInputError } from './zip';
import type { DocxArchive } from './zip';

const REL_NS_TAG = 'Relationship';
const SAFE_HYPERLINK_TARGET = /^(https?:|mailto:)/i;
/** Word style ids are plain names; anything with CSS/HTML metacharacters is refused. */
const SAFE_STYLE_ID = /^[\p{L}\p{N}_ -]{1,64}$/u;
const UNSAFE_FONT_CHARS = /[;{}<>"'\\&]/;

/** Only these parts are turned into CSS text by docx-preview; body runs reach the DOM through element.style/attributes. */
const CSS_SOURCE_PARTS = new Set(['word/styles.xml', 'word/numbering.xml']);

function parseXml(bytes: Uint8Array): Document | null {
  const doc = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(bytes), 'application/xml');
  return doc.getElementsByTagName('parsererror')[0] ? null : doc;
}

function sanitizeRels(data: Uint8Array): Uint8Array {
  const doc = parseXml(data);
  if (!doc) return data;
  let changed = false;
  for (const rel of Array.from(doc.getElementsByTagName(REL_NS_TAG))) {
    if (rel.getAttribute('TargetMode') !== 'External') continue;
    const isHyperlink = (rel.getAttribute('Type') ?? '').endsWith('/hyperlink');
    if (isHyperlink && SAFE_HYPERLINK_TARGET.test((rel.getAttribute('Target') ?? '').trim())) continue;
    rel.parentNode?.removeChild(rel);
    changed = true;
  }
  return changed ? new TextEncoder().encode(new XMLSerializer().serializeToString(doc)) : data;
}

// Text scan instead of DOM walking: styles.xml is ~350 KB / 9k elements and attribute iteration in jsdom is very slow.
// Raw attribute text is checked, so XML character references (`&#123;`) are rejected too.
const STYLE_ID_ATTR = /[\w.-]+:styleId="([^"]*)"/g;
const STYLE_REF_ELEMENT = /<[\w.-]+:(?:basedOn|link|next|pStyle|rStyle|tblStyle|numStyleLink|styleLink)\s[^>]*?:val="([^"]*)"/g;
const RFONTS_ELEMENT = /<[\w.-]+:rFonts\s[^>]*>/g;
const ATTR_VALUE = /="([^"]*)"/g;

function assertSafeStyles(name: string, data: Uint8Array): void {
  const text = new TextDecoder('utf-8').decode(data);
  for (const re of [STYLE_ID_ATTR, STYLE_REF_ELEMENT]) {
    for (const m of text.matchAll(re)) {
      if (!SAFE_STYLE_ID.test(m[1] ?? '')) {
        throw new DocxInputError('UNSAFE_CONTENT', `${name} has a style name with unsupported characters.`);
      }
    }
  }
  for (const tag of text.matchAll(RFONTS_ELEMENT)) {
    for (const v of tag[0].matchAll(ATTR_VALUE)) {
      if (UNSAFE_FONT_CHARS.test(v[1] ?? '')) {
        throw new DocxInputError('UNSAFE_CONTENT', `${name} has a font name with unsupported characters.`);
      }
    }
  }
}

/** Sanitises `archive` in place. Throws DocxInputError('UNSAFE_CONTENT') for style/font names that could inject CSS. */
export function sanitizeArchive(archive: DocxArchive): void {
  for (const [name, data] of Array.from(archive)) {
    if (name.endsWith('.rels')) {
      archive.set(name, sanitizeRels(data));
    } else if (CSS_SOURCE_PARTS.has(name)) {
      assertSafeStyles(name, data);
    }
  }
}
