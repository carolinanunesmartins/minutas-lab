import { checkGrounding } from './grounding';
import { ExtractResponseSchema } from './schema';
import type { ExtractRequest, ExtractResult, GroundedField, LlmProvider } from './types';
import { LlmProviderError } from './types';

const MAX_TEXT_CHARS = 20_000;

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenced ? (fenced[1] as string) : trimmed;
}

/**
 * Calls the provider, Zod-validates the response, and grounds every proposal
 * (SPEC.md §10). This is the one place both the live Anthropic adapter and
 * the offline ReplayProvider funnel through, so grounding behaves identically
 * for both — never applied automatically; the caller (UI) decides per field.
 */
export async function runExtraction(provider: LlmProvider, request: ExtractRequest): Promise<ExtractResult> {
  if (request.text.length > MAX_TEXT_CHARS) {
    throw new LlmProviderError('SCHEMA_INVALID', `text exceeds the ${MAX_TEXT_CHARS}-char limit.`);
  }

  const raw = await provider.complete(request);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new LlmProviderError('INVALID_JSON', 'Model response was not valid JSON.');
  }

  const validated = ExtractResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new LlmProviderError('SCHEMA_INVALID', `Model response did not match the expected schema: ${validated.error.message}`);
  }

  const fields: GroundedField[] = [];
  let rejectedCount = 0;

  for (const spec of request.fields) {
    const proposal = validated.data.fields[spec.id];
    if (!proposal) {
      fields.push({ id: spec.id, value: null, quote: null, grounded: true });
      continue;
    }
    const { grounded } = checkGrounding(proposal, request.text, spec.type);
    if (!grounded) rejectedCount += 1;
    fields.push({
      id: spec.id,
      value: grounded ? proposal.value : null,
      quote: grounded ? proposal.quote : null,
      grounded,
    });
  }

  return { fields, rejectedCount };
}
