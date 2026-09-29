import { z } from 'zod';

// REQ-LLM (SPEC.md §10): Output (Zod): {fields: {[id]: {value: string|null, quote: string|null}}}.
export const ExtractProposalSchema = z.object({
  value: z.string().nullable(),
  quote: z.string().nullable(),
});

export const ExtractResponseSchema = z.object({
  fields: z.record(ExtractProposalSchema),
});

export type ExtractProposalParsed = z.infer<typeof ExtractProposalSchema>;
export type ExtractResponseParsed = z.infer<typeof ExtractResponseSchema>;
