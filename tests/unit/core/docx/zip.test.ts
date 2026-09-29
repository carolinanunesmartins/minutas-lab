import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { DOCX_LIMITS, DocxInputError, readDocxArchive } from '../../../../src/core/docx/zip';
import { readDocx } from '../../../../src/core/docx/read';

function zip(files: Record<string, Uint8Array>): Uint8Array {
  return zipSync(files, { level: 9 });
}

function codeOf(fn: () => unknown): string {
  try {
    fn();
    throw new Error('expected to throw');
  } catch (e) {
    if (e instanceof DocxInputError) return e.code;
    throw e;
  }
}

describe('readDocxArchive — bounded reading (REQ-SEC, ADR-0007)', () => {
  it('rejects a file over the overall size limit', () => {
    expect(codeOf(() => readDocxArchive(new Uint8Array(DOCX_LIMITS.maxFileBytes + 1)))).toBe('FILE_TOO_LARGE');
  });

  it('rejects non-zip bytes', () => {
    expect(codeOf(() => readDocxArchive(new Uint8Array([1, 2, 3, 4, 5])))).toBe('NOT_A_ZIP');
  });

  it('rejects more than the max entry count', () => {
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < DOCX_LIMITS.maxEntries + 1; i += 1) {
      files[`f${i}.txt`] = new Uint8Array([1]);
    }
    expect(codeOf(() => readDocxArchive(zip(files)))).toBe('TOO_MANY_ENTRIES');
  });

  it('rejects a single entry over the per-entry uncompressed limit without fully inflating it', () => {
    // Highly compressible so the *archive* stays well under maxFileBytes while the
    // entry's own declared uncompressed size exceeds maxEntryUncompressedBytes.
    const big = new Uint8Array(DOCX_LIMITS.maxEntryUncompressedBytes + 1024);
    const archive = zip({ 'big.bin': big });
    expect(archive.byteLength).toBeLessThan(DOCX_LIMITS.maxFileBytes);
    expect(codeOf(() => readDocxArchive(archive))).toBe('ENTRY_TOO_LARGE');
  });

  it('rejects entries whose combined uncompressed size exceeds the total limit', () => {
    const perEntry = 9 * 1024 * 1024; // under the per-entry cap, but 3x it exceeds the total cap
    const archive = zip({
      'a.bin': new Uint8Array(perEntry),
      'b.bin': new Uint8Array(perEntry),
      'c.bin': new Uint8Array(perEntry),
    });
    expect(archive.byteLength).toBeLessThan(DOCX_LIMITS.maxFileBytes);
    expect(codeOf(() => readDocxArchive(archive))).toBe('TOTAL_UNCOMPRESSED_TOO_LARGE');
  });

  it('accepts a small well-formed archive', () => {
    const archive = zip({ 'hello.txt': new TextEncoder().encode('hi') });
    expect(readDocxArchive(archive).get('hello.txt')).toBeInstanceOf(Uint8Array);
  });
});

describe('readDocx — malformed .docx contents', () => {
  it('MISSING_DOCUMENT_XML when word/document.xml is absent', () => {
    const archive = zip({ 'hello.txt': new TextEncoder().encode('hi') });
    expect(codeOf(() => readDocx(archive))).toBe('MISSING_DOCUMENT_XML');
  });

  it('MALFORMED_XML when word/document.xml is not valid XML', () => {
    const archive = zip({ 'word/document.xml': new TextEncoder().encode('<w:document><unclosed>') });
    expect(codeOf(() => readDocx(archive))).toBe('MALFORMED_XML');
  });
});
