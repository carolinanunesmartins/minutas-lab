// REQ-LLM (SPEC.md §10). The LLM only ever proposes field values — it never
// writes clauses, and proposals are never auto-applied (AGENTS.md §4 rule 3).
import type { TagType } from '../core/tags/types';

export interface ExtractFieldSpec {
  id: string;
  label: string;
  type: TagType;
  help?: string;
}

export interface ExtractRequest {
  templateId: string;
  fields: ExtractFieldSpec[];
  /** Pasted source text, <= 20,000 chars (SPEC.md §10) — caller truncates/rejects before building this. */
  text: string;
}

/** Raw (unvalidated) shape the model is asked to produce — validated against ExtractResponseSchema before use. */
export interface RawExtractProposal {
  value: string | null;
  quote: string | null;
}

export interface RawExtractResponse {
  fields: Record<string, RawExtractProposal>;
}

/** Per-field result after Zod validation + grounding (SPEC.md §10). */
export interface GroundedField {
  id: string;
  value: string | null;
  quote: string | null;
  /** false = grounding failed (quote not a substring, or digit mismatch for typed fields) — rejected, counted, never shown as an accepted proposal. */
  grounded: boolean;
}

export interface ExtractResult {
  fields: GroundedField[];
  /** Count of proposals rejected by grounding (SPEC.md §11 "quote rejections" metric). */
  rejectedCount: number;
}

/**
 * A provider turns a validated ExtractRequest into the model's raw JSON text
 * response (not yet parsed/validated — that's extract.ts's job, shared by
 * every provider so Zod validation + grounding behave identically for real
 * and replayed responses).
 */
export interface LlmProvider {
  complete(request: ExtractRequest): Promise<string>;
}

export class LlmProviderError extends Error {
  readonly code: 'TIMEOUT' | 'HTTP_ERROR' | 'NO_FIXTURE' | 'INVALID_JSON' | 'SCHEMA_INVALID';
  constructor(code: LlmProviderError['code'], message: string) {
    super(message);
    this.name = 'LlmProviderError';
    this.code = code;
  }
}
