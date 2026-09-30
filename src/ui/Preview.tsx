import { useEffect, useRef } from 'react';
import { renderAsync } from 'docx-preview';
import { messages } from './messages.pt';

interface PreviewProps {
  bytes: ArrayBuffer | null;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Renders `bytes` via docx-preview into an offscreen buffer, then swaps it
 * into view — avoids the flash/scroll-jump of re-rendering the visible pane
 * in place (SPEC.md §7: "double-buffer swap; keeping scroll"). The swap
 * itself crossfades (opacity only — transform/opacity stay off the main
 * thread) rather than snapping, since the two buffers briefly overlap.
 */
export function Preview({ bytes }: PreviewProps) {
  const containerARef = useRef<HTMLDivElement>(null);
  const containerBRef = useRef<HTMLDivElement>(null);
  const activeBufferRef = useRef<'A' | 'B'>('A');
  const renderTokenRef = useRef(0);

  useEffect(() => {
    if (!bytes) return;
    const token = renderTokenRef.current + 1;
    renderTokenRef.current = token;

    const active = activeBufferRef.current;
    const activeEl = (active === 'A' ? containerARef : containerBRef).current;
    const inactiveEl = (active === 'A' ? containerBRef : containerARef).current;
    if (!inactiveEl) return;

    inactiveEl.replaceChildren();
    const blob = new Blob([bytes], { type: DOCX_MIME });
    void renderAsync(blob, inactiveEl, undefined, { ignoreLastRenderedPageBreak: false, inWrapper: true }).then(() => {
      if (renderTokenRef.current !== token) return; // a newer render superseded this one
      inactiveEl.scrollTop = activeEl?.scrollTop ?? 0;
      inactiveEl.classList.remove('opacity-0', 'pointer-events-none');
      inactiveEl.dataset.active = 'true';
      activeEl?.classList.add('opacity-0', 'pointer-events-none');
      if (activeEl) activeEl.dataset.active = 'false';
      activeBufferRef.current = active === 'A' ? 'B' : 'A';
    });
  }, [bytes]);

  return (
    <div className="relative h-full overflow-hidden bg-paper" aria-label={messages.previewTitle}>
      {!bytes && <p className="p-6 text-sm text-paper-ink-dim">{messages.previewEmpty}</p>}
      <div
        ref={containerARef}
        data-active="true"
        className="docx-preview-pane absolute inset-0 overflow-auto bg-paper opacity-100 transition-opacity duration-300 ease-out-quart"
      />
      <div
        ref={containerBRef}
        data-active="false"
        className="docx-preview-pane pointer-events-none absolute inset-0 overflow-auto bg-paper opacity-0 transition-opacity duration-300 ease-out-quart"
      />
    </div>
  );
}
