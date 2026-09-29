import extractPromptV1 from './prompts/extract.v1.md?raw';
import type { ExtractRequest, LlmProvider } from './types';
import { LlmProviderError } from './types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-5';
const TIMEOUT_MS = 20_000;

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicMessagesResponse {
  content?: AnthropicContentBlock[];
}

export function buildExtractPrompt(request: ExtractRequest): string {
  const fields = request.fields.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    ...(f.help !== undefined && { help: f.help }),
  }));
  return extractPromptV1.replace('{{FIELDS_JSON}}', JSON.stringify(fields, null, 2)).replace('{{SOURCE_TEXT}}', request.text);
}

export interface AnthropicProviderOptions {
  /** BYOK — kept in memory only by the caller (AGENTS.md §4 rule 5); never persisted here either. */
  apiKey: string;
  model?: string;
}

/**
 * Direct browser -> Anthropic API calls (BYOK, SPEC.md §10). Sends
 * `anthropic-dangerous-direct-browser-access` so the API accepts a
 * browser-origin request — HUMAN must still verify this actually clears CORS
 * for a given account/key (SPEC.md §10's own "verify provider CORS from
 * browser (HUMAN)" note); this adapter is written and ready either way.
 */
export class AnthropicProvider implements LlmProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: AnthropicProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
  }

  async complete(request: ExtractRequest): Promise<string> {
    try {
      return await this.attempt(request);
    } catch {
      return await this.attempt(request); // <= 1 retry (SPEC.md §10)
    }
  }

  private async attempt(request: ExtractRequest): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          temperature: 0,
          messages: [{ role: 'user', content: buildExtractPrompt(request) }],
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new LlmProviderError('HTTP_ERROR', `Anthropic API returned HTTP ${response.status}.`);
      }
      const data = (await response.json()) as AnthropicMessagesResponse;
      const text = data.content?.find((block) => block.type === 'text')?.text;
      if (text === undefined) {
        throw new LlmProviderError('INVALID_JSON', 'Anthropic response had no text content block.');
      }
      return text;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw new LlmProviderError('TIMEOUT', 'Anthropic API request timed out.');
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
}
