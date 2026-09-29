# ADR-0002: Own tag engine instead of docxtemplater, using DOMParser/XMLSerializer

## Status
Accepted

## Context
The app needs to find `{{tag}}` markers inside `word/document.xml` (including ones split across multiple `<w:r>` runs by Word's own re-flowing) and replace them with user values while preserving formatting (the first run's `rPr`), plus support block/conditional tags, computed numbering (`cl`/`pt`/`al`), and cross-references (`ref:`) per SPEC.md §3–4. `docxtemplater` solves a similar problem but is a paid/dual-licensed dependency for some features, pulls in its own module system, and isn't designed around our specific grammar (blocks-alone-in-paragraph, computed numbering, anchors) — adapting it would fight the library more than using it.

AGENTS.md §3 states `src/core` must be "pure TS ... NO DOM". Read literally against parsing/mutating `document.xml`, this needs clarification: XML manipulation without *some* parser is impractical to do robustly (escaping, namespaces, nested elements) by hand-rolled string surgery.

## Decision
- Write our own tag parser (`src/core/tags`) and DOCX run-map/replacement engine (`src/core/docx`), tailored to SPEC.md §3's exact grammar, instead of adopting docxtemplater.
- Interpret AGENTS.md's "no DOM" as *no page DOM* (no `document`/`window`, no live-page coupling) — not a ban on the standalone `DOMParser`/`XMLSerializer` APIs, which construct detached documents.
- Zip container handling is a separate concern, covered by ADR-0007.

## Amendment (M4): DOMParser/XMLSerializer are not actually available in Workers
This ADR originally assumed `DOMParser`/`XMLSerializer` are available inside Web Workers, matching the spec ("DOM Parsing and Serialization" lists `Window` *and* `WorkerGlobalScope` as valid contexts). **That assumption was wrong in practice**: verified empirically in M4 (T4.2) that Chrome's dedicated Worker global scope does not expose either constructor (`typeof DOMParser === 'undefined'` inside a real worker). Node's `tsx`-run scripts have the same gap (no browser DOM at all), which M3's `lint-templates.ts` already worked around with a `jsdom`-sourced polyfill — jsdom itself isn't usable in a browser Worker (it depends on Node built-ins), so a different fix was needed there.

Fix: `src/workers/build.worker.ts` polyfills `self.DOMParser`/`self.XMLSerializer` with `@xmldom/xmldom` (small, dependency-free, pure JS — works in any JS environment) before calling into `src/core/docx`. Verified compatible with everything `src/core/docx` uses (namespaced element/attribute access, `cloneNode`, `createTextNode`, `insertBefore`/`removeChild`, XML-escaping serialization). `src/core/docx` itself is unchanged — it still just calls the global `DOMParser`/`XMLSerializer`, unaware of which implementation is behind them.

## Consequences
- Full control over the tag grammar (blocks alone in paragraph, `cl`/`pt`/`al` numbering, anchors/refs, error codes) without fighting a general-purpose templating library.
- `src/core/docx` and `src/core/tags` stay page-DOM-free and portable across Node (via a polyfill), the main thread, and a Worker — but *not* free of needing **some** DOMParser/XMLSerializer implementation supplied by the caller's environment, which turned out to require an explicit polyfill in two of those three environments, not just one.
- Slightly more code to write and test ourselves (run-map extraction, span replacement, XML escaping) versus delegating to a library — accepted given the grammar is bespoke anyway.
- New runtime dependency `@xmldom/xmldom` (AGENTS.md §4 rule 10 — this amendment is that ADR), scoped to the worker bundle only (never imported by `src/ui`, so it doesn't add weight to the main thread's initial load).
