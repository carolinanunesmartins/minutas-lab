import { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { BLOCK_ANCHOR_PREFIX, FIELD_ANCHOR_PREFIX } from '../core/docx/build';
import { messages } from './messages.pt';

interface PreviewProps {
  bytes: ArrayBuffer | null;
  /** Field the preview should keep in view (focused input, else the one just edited). */
  focusFieldId: string | undefined;
  /** Called when the user clicks a field's text in the preview. */
  onFieldClick: (fieldId: string) => void;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ANCHOR_NAME = new RegExp(`^${FIELD_ANCHOR_PREFIX}(.+)_\\d+$`);
const BLOCK_NAME = new RegExp(`^${BLOCK_ANCHOR_PREFIX}(.+)$`);

/**
 * build.ts wraps each value run in a `fld_<id>_<n>` bookmark; docx-preview
 * renders that as an empty `<span id=...>` right before the run. Move the id
 * onto the run itself as `data-field` (both buffers render the same document,
 * so leaving ids in place would duplicate them).
 */
/** Belt and braces on top of sanitizeArchive: only http(s)/mailto links, always opened in a new, isolated context. */
function hardenLinks(container: HTMLElement): void {
  for (const a of Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    if (/^(https?:|mailto:)/i.test(a.getAttribute('href') ?? '')) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    } else {
      a.removeAttribute('href');
    }
  }
}

function tagFieldRuns(container: HTMLElement): void {
  for (const marker of Array.from(container.querySelectorAll<HTMLElement>(`span[id^="${FIELD_ANCHOR_PREFIX}"]`))) {
    const fieldId = ANCHOR_NAME.exec(marker.id)?.[1];
    const run = marker.nextElementSibling;
    if (fieldId && run instanceof HTMLElement) {
      run.dataset.field = fieldId;
      run.title = messages.previewFieldHint;
      // Empty values render as "[field_id]": flag them so CSS can add a non-colour cue (WCAG 1.4.1).
      if (/^\[.*\]$/.test(run.textContent?.trim() ?? '')) run.dataset.empty = 'true';
    }
    marker.removeAttribute('id');
  }
  // Conditional-block anchors sit at the start of the block's first paragraph.
  for (const marker of Array.from(container.querySelectorAll<HTMLElement>(`span[id^="${BLOCK_ANCHOR_PREFIX}"]`))) {
    const blockId = BLOCK_NAME.exec(marker.id)?.[1];
    const paragraph = marker.closest('p');
    if (blockId && paragraph) {
      paragraph.dataset.blocks = `${paragraph.dataset.blocks ?? ''} ${blockId}`.trim();
    }
    marker.removeAttribute('id');
  }
}

// "CLÁUSULA PRIMEIRA" heading (+ its "(Objeto)" title line): tagged so CSS can add breathing room.
function markClauses(container: HTMLElement): void {
  for (const p of Array.from(container.querySelectorAll<HTMLElement>('article > p'))) {
    if (!/^CLÁUSULA/.test(p.textContent?.trim() ?? '')) continue;
    p.classList.add('clause-start');
    const title = p.nextElementSibling;
    if (title instanceof HTMLElement && title.textContent?.trim().startsWith('(')) title.classList.add('clause-title');
  }
}

const zoomButton =
  'inline-flex min-h-9 min-w-9 items-center justify-center rounded px-2 text-lg font-semibold leading-none hover:bg-paper-dim active:scale-[0.97]';
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
// docx-preview wraps pages in .docx-wrapper with ~30px padding each side.
const WRAPPER_PADDING = 60;

/** Scale at which one page (plus wrapper padding) exactly fills the pane's width; never enlarges past 100%. */
function computeFitScale(pane: HTMLElement): number | undefined {
  const page = pane.querySelector<HTMLElement>('section.docx');
  const pageWidth = page ? parseFloat(page.style.width) || page.offsetWidth : 0;
  if (!pageWidth || pane.clientWidth === 0) return undefined;
  return Math.min(1, Math.max(MIN_ZOOM, pane.clientWidth / (pageWidth + WRAPPER_PADDING)));
}

function applyScale(pane: HTMLElement | null, scale: number): void {
  const wrapper = pane?.querySelector<HTMLElement>('.docx-wrapper');
  if (wrapper) wrapper.style.zoom = String(scale);
}

// Scrolls only the pane itself (scrollIntoView would also drag the page,
// fighting the sticky preview on small screens).
function scrollToField(container: HTMLElement, fieldId: string): void {
  const id = CSS.escape(fieldId);
  const fieldRun = container.querySelector<HTMLElement>(`[data-field="${id}"]`);
  // A checkbox toggles a whole clause: fall back to (and flash) its paragraph.
  const target = fieldRun ?? container.querySelector<HTMLElement>(`[data-blocks~="${id}"]`);
  if (!target) return;
  const c = container.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  const top = container.scrollTop + (t.top - c.top) - (c.height - Math.min(t.height, c.height)) / 2;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  container.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
  if (!fieldRun) {
    target.classList.remove('block-flash');
    void target.offsetWidth; // restart the animation if it is already running
    target.classList.add('block-flash');
  }
}

/**
 * Renders `bytes` via docx-preview into an offscreen buffer, then swaps it
 * into view — avoids the flash/scroll-jump of re-rendering the visible pane
 * in place (SPEC.md §7: "double-buffer swap; keeping scroll"). The swap
 * itself crossfades (opacity only — transform/opacity stay off the main
 * thread) rather than snapping, since the two buffers briefly overlap.
 */
export function Preview({ bytes, focusFieldId, onFieldClick }: PreviewProps) {
  const containerARef = useRef<HTMLDivElement>(null);
  const containerBRef = useRef<HTMLDivElement>(null);
  const activeBufferRef = useRef<'A' | 'B'>('A');
  const renderTokenRef = useRef(0);
  // Read inside async render callbacks without re-running the render effect.
  const focusFieldIdRef = useRef(focusFieldId);
  focusFieldIdRef.current = focusFieldId;

  // 'fit' follows the pane width; a number is a manual zoom chosen with the +/- buttons.
  const [zoom, setZoom] = useState<'fit' | number>('fit');
  const [fitScale, setFitScale] = useState(1);
  const scale = zoom === 'fit' ? fitScale : zoom;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const rootRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const activePane = (): HTMLDivElement | null => (activeBufferRef.current === 'A' ? containerARef : containerBRef).current;

  // Re-measure the fit scale whenever the pane is resized.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => {
      const fit = activePane() ? computeFitScale(activePane() as HTMLElement) : undefined;
      if (fit !== undefined) setFitScale(fit);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // Apply the current scale to both buffers (the hidden one too, so a swap never jumps).
  useEffect(() => {
    applyScale(containerARef.current, scale);
    applyScale(containerBRef.current, scale);
  }, [scale]);

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
      tagFieldRuns(inactiveEl);
      hardenLinks(inactiveEl);
      markClauses(inactiveEl);
      const fit = computeFitScale(inactiveEl);
      if (fit !== undefined) setFitScale(fit);
      applyScale(inactiveEl, zoomRef.current === 'fit' ? (fit ?? scaleRef.current) : zoomRef.current);
      inactiveEl.scrollTop = activeEl?.scrollTop ?? 0;
      // Whatever is focused *now* wins over what triggered this build — a
      // slow rebuild for a field you've already left must not yank the view back.
      if (focusFieldIdRef.current) scrollToField(inactiveEl, focusFieldIdRef.current);
      inactiveEl.dataset.active = 'true';
      if (activeEl) activeEl.dataset.active = 'false';
      activeBufferRef.current = active === 'A' ? 'B' : 'A';
    });
  }, [bytes]);

  // Focusing (or clicking into) a field jumps to it right away — no rebuild
  // needed, the anchors are already in the rendered pane.
  useEffect(() => {
    if (!focusFieldId) return;
    const pane = (activeBufferRef.current === 'A' ? containerARef : containerBRef).current;
    if (pane) scrollToField(pane, focusFieldId);
  }, [focusFieldId]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>): void {
    const fieldId = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-field]')?.dataset.field : undefined;
    if (fieldId) onFieldClick(fieldId);
  }

  return (
    // Clicking preview text is a pointer shortcut only; the form inputs remain the accessible way to edit.
    <div ref={rootRef} className="relative h-full overflow-hidden bg-paper" aria-label={messages.previewTitle} onClick={handleClick}>
      <div
        className="absolute bottom-3 right-5 z-10 flex items-center gap-0.5 rounded-md border border-paper-line bg-paper/95 p-0.5 text-paper-ink shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
        role="group"
        aria-label={messages.zoomLabel}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={zoomButton} onClick={() => setZoom(Math.max(MIN_ZOOM, Math.round((scale - ZOOM_STEP) * 10) / 10))} aria-label={messages.zoomOut}>
          −
        </button>
        <button type="button" className={`${zoomButton} min-w-14 text-sm tabular-nums`} onClick={() => setZoom('fit')} aria-label={messages.zoomFit} aria-pressed={zoom === 'fit'}>
          {Math.round(scale * 100)}%
        </button>
        <button type="button" className={zoomButton} onClick={() => setZoom(Math.min(MAX_ZOOM, Math.round((scale + ZOOM_STEP) * 10) / 10))} aria-label={messages.zoomIn}>
          +
        </button>
      </div>
      {!bytes && <p className="p-6 text-sm text-paper-ink-dim">{messages.previewEmpty}</p>}
      <div
        ref={containerARef}
        data-active="true"
        className="docx-preview-pane absolute inset-0 overflow-auto bg-paper opacity-100 transition-opacity duration-300 ease-out-quart data-[active=false]:pointer-events-none data-[active=false]:opacity-0"
      />
      <div
        ref={containerBRef}
        data-active="false"
        className="docx-preview-pane absolute inset-0 overflow-auto bg-paper opacity-100 transition-opacity duration-300 ease-out-quart data-[active=false]:pointer-events-none data-[active=false]:opacity-0"
      />
    </div>
  );
}
