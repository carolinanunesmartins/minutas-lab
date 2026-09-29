import type { ShadingOptions } from '../core/docx/build';
import type { BuildWorkerRequest, BuildWorkerResponse } from '../workers/protocol';

export class BuildWorkerError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'BuildWorkerError';
    this.code = code;
  }
}

export interface BuildRequestOptions {
  templateBytes: ArrayBuffer;
  values: Record<string, string>;
  disclaimerText: string;
  draftNote?: string;
  shading?: ShadingOptions;
}

/** Thin request/response wrapper around the build Web Worker (T1.1-T3.4 assembled by src/core/docx/build.ts). */
export class BuildClient {
  private readonly worker: Worker;
  private nextRequestId = 1;
  private readonly pending = new Map<number, { resolve: (bytes: ArrayBuffer) => void; reject: (err: Error) => void }>();

  constructor() {
    this.worker = new Worker(new URL('../workers/build.worker.ts', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', (event: MessageEvent<BuildWorkerResponse>) => {
      const entry = this.pending.get(event.data.requestId);
      if (!entry) return;
      this.pending.delete(event.data.requestId);
      if (event.data.type === 'result') {
        entry.resolve(event.data.bytes);
      } else {
        entry.reject(new BuildWorkerError(event.data.code, event.data.message));
      }
    });
  }

  build(options: BuildRequestOptions): Promise<ArrayBuffer> {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    return new Promise<ArrayBuffer>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      const request: BuildWorkerRequest = { type: 'build', requestId, ...options };
      this.worker.postMessage(request);
    });
  }

  terminate(): void {
    this.worker.terminate();
    this.pending.clear();
  }
}
