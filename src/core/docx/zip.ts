import { unzipSync } from 'fflate';
import type { UnzipFileInfo } from 'fflate';

// REQ-SEC (SPEC.md §9). Baseline size bounds only — full input guard (encrypted /
// vbaProject / path-traversal rejection, error UI) is M4 T4.4; see ADR-0007.
export const DOCX_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxEntries: 200,
  maxEntryUncompressedBytes: 15 * 1024 * 1024,
  maxTotalUncompressedBytes: 25 * 1024 * 1024,
} as const;

export type DocxInputErrorCode =
  | 'FILE_TOO_LARGE'
  | 'NOT_A_ZIP'
  | 'TOO_MANY_ENTRIES'
  | 'ENTRY_TOO_LARGE'
  | 'TOTAL_UNCOMPRESSED_TOO_LARGE'
  | 'MISSING_DOCUMENT_XML'
  | 'MALFORMED_XML'
  | 'UNSAFE_CONTENT';

export class DocxInputError extends Error {
  readonly code: DocxInputErrorCode;

  constructor(code: DocxInputErrorCode, message: string) {
    super(message);
    this.name = 'DocxInputError';
    this.code = code;
  }
}

/** Path traversal / absolute / backslash names, macros and ActiveX controls (SPEC.md §9). */
const UNSAFE_ENTRY_NAME = /(^|\/)\.\.(\/|$)|^\/|\\|vbaProject|(^|\/)activeX\//i;

const ZIP_LOCAL_FILE_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

function looksLikeZip(bytes: Uint8Array): boolean {
  return ZIP_LOCAL_FILE_SIGNATURE.every((byte, i) => bytes[i] === byte);
}

export type DocxArchive = Map<string, Uint8Array>;

/** Bounded-read a .docx as a zip archive. Throws DocxInputError on any limit breach. */
export function readDocxArchive(bytes: Uint8Array): DocxArchive {
  if (bytes.byteLength > DOCX_LIMITS.maxFileBytes) {
    throw new DocxInputError('FILE_TOO_LARGE', `File is ${bytes.byteLength} bytes, max is ${DOCX_LIMITS.maxFileBytes}.`);
  }
  if (bytes.byteLength < 4 || !looksLikeZip(bytes)) {
    throw new DocxInputError('NOT_A_ZIP', 'File does not look like a .docx (zip) archive.');
  }

  let entryCount = 0;
  let totalUncompressed = 0;
  let violation: DocxInputError | null = null;

  const filter = (file: UnzipFileInfo): boolean => {
    entryCount += 1;
    if (UNSAFE_ENTRY_NAME.test(file.name)) {
      violation ??= new DocxInputError('UNSAFE_CONTENT', `Entry "${file.name}" is not allowed in a .docx.`);
      return false;
    }
    if (entryCount > DOCX_LIMITS.maxEntries) {
      violation ??= new DocxInputError('TOO_MANY_ENTRIES', `Archive has more than ${DOCX_LIMITS.maxEntries} entries.`);
      return false;
    }
    if (file.originalSize > DOCX_LIMITS.maxEntryUncompressedBytes) {
      violation ??= new DocxInputError('ENTRY_TOO_LARGE', `Entry "${file.name}" exceeds the per-entry size limit.`);
      return false;
    }
    totalUncompressed += file.originalSize;
    if (totalUncompressed > DOCX_LIMITS.maxTotalUncompressedBytes) {
      violation ??= new DocxInputError('TOTAL_UNCOMPRESSED_TOO_LARGE', 'Archive exceeds the total uncompressed size limit.');
      return false;
    }
    return true;
  };

  const unzipped = unzipSync(bytes, { filter });
  if (violation !== null) {
    const err: DocxInputError = violation;
    throw err;
  }

  return new Map(Object.entries(unzipped));
}
