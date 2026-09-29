// Chrome's (and other browsers') dedicated Worker global scope does NOT
// actually expose DOMParser/XMLSerializer, despite the spec allowing it —
// confirmed empirically (see ADR-0002's amendment). Polyfill with
// @xmldom/xmldom (small, dependency-free, browser-safe) before anything
// calls readDocx()/buildDocx() (both only construct DOMParser/XMLSerializer
// inside function bodies, never at module-import time, so assigning the
// polyfill here — before the message handler ever runs — is sufficient).
import { DOMParser as XmlDomParser, XMLSerializer as XmlDomSerializer } from '@xmldom/xmldom';
import { buildDocx } from '../core/docx/build';
import { DocxInputError } from '../core/docx/zip';
import { readDocx } from '../core/docx/read';
import type { BuildWorkerRequest, BuildWorkerResponse } from './protocol';

(self as unknown as { DOMParser: unknown }).DOMParser = XmlDomParser;
(self as unknown as { XMLSerializer: unknown }).XMLSerializer = XmlDomSerializer;

self.addEventListener('message', (event: MessageEvent<BuildWorkerRequest>) => {
  const { type, requestId, templateBytes, values, disclaimerText, draftNote, shading } = event.data;
  if (type !== 'build') return;

  try {
    const doc = readDocx(new Uint8Array(templateBytes));
    const bytes = buildDocx({
      doc,
      values,
      disclaimerText,
      ...(draftNote !== undefined && { draftNote }),
      ...(shading !== undefined && { shading }),
    });
    const response: BuildWorkerResponse = { type: 'result', requestId, bytes: bytes.buffer as ArrayBuffer };
    self.postMessage(response, [response.bytes]);
  } catch (e) {
    const code = e instanceof DocxInputError ? e.code : 'BUILD_ERROR';
    const message = e instanceof Error ? e.message : String(e);
    const response: BuildWorkerResponse = { type: 'error', requestId, code, message };
    self.postMessage(response);
  }
});
