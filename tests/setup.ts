import '@testing-library/jest-dom/vitest';

// jsdom has no Worker implementation. Component tests that construct a
// BuildClient (src/ui/buildClient.ts) need *something* here to avoid
// crashing on mount; real worker behavior is covered by the Playwright e2e
// suite (tests/e2e), which runs against an actual browser.
class NoopWorker implements Partial<Worker> {
  onmessage = null;
  onmessageerror = null;
  onerror = null;
  addEventListener(): void {}
  removeEventListener(): void {}
  postMessage(): void {}
  terminate(): void {}
  dispatchEvent(): boolean {
    return true;
  }
}

(globalThis as unknown as { Worker: typeof NoopWorker }).Worker = NoopWorker;

