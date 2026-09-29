import type { ShadingOptions } from '../core/docx/build';

// Pure types only (no DOM/WebWorker globals) so both the worker (WebWorker
// lib) and the UI client (DOM lib) can import this without pulling
// environment-specific globals into the wrong tsconfig's program.

export interface BuildWorkerRequest {
  type: 'build';
  requestId: number;
  templateBytes: ArrayBuffer;
  values: Record<string, string>;
  disclaimerText: string;
  draftNote?: string;
  shading?: ShadingOptions;
}

export type BuildWorkerResponse =
  | { type: 'result'; requestId: number; bytes: ArrayBuffer }
  | { type: 'error'; requestId: number; code: string; message: string };
