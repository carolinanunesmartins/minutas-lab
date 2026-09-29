# ADR-0007: fflate for zip reading, with bounded-inflation limits

## Status
Accepted

## Context
A `.docx` is a zip archive. SPEC.md §9 flags that JSZip alone is not sufficient protection against zip-bomb-style inputs (a measured 41 KB archive inflating to ~40 MB in ~0.9 s), and requires bounded reading: file ≤ 5 MiB, ≤ 200 entries, total uncompressed ≤ 25 MiB, per-entry ≤ 15 MiB (limits calibrated later if needed).

## Decision
Use `fflate`'s `unzipSync` with its `filter` option. `filter` is called with each entry's metadata (`name`, `size` = compressed, `originalSize` = uncompressed) *before* that entry is inflated, and returning `false` skips decompression entirely. `src/core/docx/zip.ts` uses this to enforce, without inflating past the limit:
- overall file size (checked before touching the zip at all),
- max entry count,
- max per-entry uncompressed size,
- max total uncompressed size across accepted entries.

## Consequences
- Zip-bomb-style entries are rejected before being inflated, not after.
- This ADR covers only size bounding (M1, T1.1 "Read DOCX (bounded)"). The rest of the SPEC.md §9 input guard — rejecting encrypted archives, `vbaProject.bin`, path traversal in entry names, and user-facing error messaging — is separate and lands in M4 (T4.4), which also decides the final calibrated limits and records them here or in a follow-up ADR if they change from the SPEC.md §9 defaults used above.
- `fflate` becomes a new runtime dependency (AGENTS.md §4 rule 10 requires an ADR for this — this is that ADR). It's small, dependency-free, and used for both reading (`unzipSync`) and — later — writing the rebuilt `.docx` (`zipSync`).
