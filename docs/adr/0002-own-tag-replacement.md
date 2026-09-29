# ADR-0002: Own tag engine instead of docxtemplater, using DOMParser/XMLSerializer

## Status
Accepted

## Context
The app needs to find `{{tag}}` markers inside `word/document.xml` (including ones split across multiple `<w:r>` runs by Word's own re-flowing) and replace them with user values while preserving formatting (the first run's `rPr`), plus support block/conditional tags, computed numbering (`cl`/`pt`/`al`), and cross-references (`ref:`) per SPEC.md §3–4. `docxtemplater` solves a similar problem but is a paid/dual-licensed dependency for some features, pulls in its own module system, and isn't designed around our specific grammar (blocks-alone-in-paragraph, computed numbering, anchors) — adapting it would fight the library more than using it.

AGENTS.md §3 states `src/core` must be "pure TS ... NO DOM". Read literally against parsing/mutating `document.xml`, this needs clarification: XML manipulation without *some* parser is impractical to do robustly (escaping, namespaces, nested elements) by hand-rolled string surgery.

## Decision
- Write our own tag parser (`src/core/tags`) and DOCX run-map/replacement engine (`src/core/docx`), tailored to SPEC.md §3's exact grammar, instead of adopting docxtemplater.
- Interpret AGENTS.md's "no DOM" as *no page DOM* (no `document`/`window`, no live-page coupling) — not a ban on the standalone `DOMParser`/`XMLSerializer` APIs, which construct detached documents and are available both on the main thread and inside Web Workers (where the actual DOCX build runs, per SPEC.md §7). `src/core/docx` uses `DOMParser`/`XMLSerializer` to parse/serialize `word/document.xml` and header/footer parts; it never touches the rendered page.
- Zip container handling is a separate concern, covered by ADR-0007.

## Consequences
- Full control over the tag grammar (blocks alone in paragraph, `cl`/`pt`/`al` numbering, anchors/refs, error codes) without fighting a general-purpose templating library.
- `src/core/docx` and `src/core/tags` remain runnable in a Web Worker (no page DOM dependency), matching the SPEC.md §7 preview pipeline.
- Slightly more code to write and test ourselves (run-map extraction, span replacement, XML escaping) versus delegating to a library — accepted given the grammar is bespoke anyway.
- If "no DOM" was intended more strictly (banning `DOMParser` too), this ADR is the place to revisit that: the alternative would be a hand-written streaming XML tokenizer for the small subset of WordprocessingML we touch.
