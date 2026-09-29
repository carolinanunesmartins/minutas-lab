import type { ExtractRequest, LlmProvider } from './types';
import { LlmProviderError } from './types';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/** Stable (sorted-key) JSON serialization, so the same logical request always hashes the same. */
export function canonicalRequestJson(request: ExtractRequest): string {
  return JSON.stringify(canonicalize(request));
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export type ReplayFixtures = Readonly<Record<string, string>>;

/**
 * Deterministic, offline provider for `npm run eval` (SPEC.md §10-11):
 * fixtures are keyed by sha256 of the canonical request JSON. Never makes a
 * network call — a request with no matching fixture is an error, not a
 * silent fallback to the network.
 */
export class ReplayProvider implements LlmProvider {
  constructor(private readonly fixtures: ReplayFixtures) {}

  async complete(request: ExtractRequest): Promise<string> {
    const hash = await sha256Hex(canonicalRequestJson(request));
    const fixture = this.fixtures[hash];
    if (fixture === undefined) {
      throw new LlmProviderError('NO_FIXTURE', `No replay fixture for request hash "${hash}".`);
    }
    return fixture;
  }
}
