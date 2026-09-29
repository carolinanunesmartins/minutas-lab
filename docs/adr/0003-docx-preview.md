# ADR-0003: docx-preview for the live preview pane

## Status
Accepted

## Context
SPEC.md §7 wants a "Word-like" live preview: render the actual built `.docx` bytes as HTML in the browser, not a hand-rolled approximation of Word's layout. `docx-preview` (`VolodymyrBaydalka/docxjs`, Apache-2.0) does exactly this: it parses OOXML and renders it to HTML/CSS in a container element, and is the de-facto option for this in the browser (no first-party alternative from Microsoft).

## Decision
Use `docx-preview`'s `renderAsync(bytes, container, ...)` to render `buildDocx()`'s output into an offscreen container, then swap it into view (double-buffer, per SPEC.md §7) to avoid a visible flash/scroll-jump on every edit.

## Consequences
- New runtime dependency, pulling in `jszip` transitively (its own internal unzip step) — a second zip library alongside `fflate` (ADR-0007). Acceptable: `jszip`'s zip-bomb weakness (SPEC.md §9) only matters for *untrusted* input, and `docx-preview` only ever receives bytes `buildDocx()` just produced from an already bounded-read template — never a raw user upload directly.
- `docx-preview` renders into a live DOM container, so the preview pane (`src/ui`) owns this integration; `src/core` stays untouched (no page-DOM dependency there, per ADR-0002).
- Rendering fidelity is "approximate" by design (SPEC.md §7's own "Pré-visualização aproximada" label) — `docx-preview` doesn't reproduce every Word layout quirk, which is acceptable since the downloaded `.docx` (opened in real Word) is the actual source of truth, not the preview.
