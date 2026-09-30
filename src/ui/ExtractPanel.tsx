import { useState } from 'react';
import { AnthropicProvider } from '../llm/anthropicProvider';
import { runExtraction } from '../llm/extract';
import type { ExtractFieldSpec, ExtractResult, GroundedField } from '../llm/types';
import { buttonGhost, buttonPrimary, buttonSecondary } from './buttonStyles';
import { messages } from './messages.pt';

interface ExtractPanelProps {
  templateId: string;
  fields: ExtractFieldSpec[];
  currentValues: Record<string, string>;
  /** Applies one field's value — same setter the main form uses; never called except on explicit per-field accept. */
  onAcceptField: (id: string, value: string) => void;
}

const MAX_TEXT_CHARS = 20_000;
const inputStyles =
  'mb-1 w-full rounded border border-line bg-ink-900 px-2.5 py-1.5 text-sm text-white transition-colors duration-150 ease-out-quart placeholder:text-white/30 focus:border-brass-400';

function labelFor(fields: ExtractFieldSpec[], id: string): string {
  return fields.find((f) => f.id === id)?.label ?? id;
}

export function ExtractPanel({ templateId, fields, currentValues, onAcceptField }: ExtractPanelProps) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(): Promise<void> {
    setStatus('loading');
    setErrorMessage('');
    try {
      const provider = new AnthropicProvider({ apiKey });
      const extractResult = await runExtraction(provider, { templateId, fields, text: text.slice(0, MAX_TEXT_CHARS) });
      setResult(extractResult);
      setAccepted(new Set());
      setStatus('done');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : messages.extractErrorGeneric);
      setStatus('error');
    }
  }

  function handleAccept(field: GroundedField): void {
    if (field.value === null) return;
    onAcceptField(field.id, field.value);
    setAccepted((prev) => new Set(prev).add(field.id));
  }

  const proposals = (result?.fields ?? []).filter((f): f is GroundedField & { value: string } => f.grounded && f.value !== null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-5 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-brass-400 transition-colors duration-150 ease-out-quart hover:text-brass-300"
      >
        <span aria-hidden="true">+</span>
        {messages.extractPanelToggleOpen}
      </button>
    );
  }

  return (
    <section className="animate-rise-in mb-5 rounded-md border border-line bg-ink-900 p-4" aria-label={messages.extractPanelToggleOpen}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-white/90">{messages.extractPanelToggleOpen}</h3>
        <button type="button" onClick={() => setOpen(false)} className={buttonGhost}>
          {messages.extractPanelToggleClose}
        </button>
      </div>

      <p className="mb-3 text-xs text-white/50">{messages.extractDisclaimer}</p>

      <label htmlFor="extract-api-key" className="block text-xs font-medium text-white/70">
        {messages.extractApiKeyLabel}
      </label>
      <input
        id="extract-api-key"
        type="password"
        autoComplete="off"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder={messages.extractApiKeyPlaceholder}
        className={inputStyles}
      />
      <p className="mb-3 text-xs text-white/40">{messages.extractApiKeyHelp}</p>

      <label htmlFor="extract-text" className="block text-xs font-medium text-white/70">
        {messages.extractTextLabel}
      </label>
      <textarea
        id="extract-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_TEXT_CHARS}
        rows={6}
        className={inputStyles}
      />
      <p className="mb-3 text-xs text-white/40">{messages.extractTextHelp}</p>

      <button type="button" disabled={!apiKey || !text || status === 'loading'} onClick={() => void handleSubmit()} className={buttonPrimary}>
        {status === 'loading' ? messages.extractSubmitting : messages.extractSubmit}
      </button>

      {status === 'error' && (
        <p role="alert" className="mt-3 text-sm text-rubric-400">
          {errorMessage || messages.extractErrorGeneric}
        </p>
      )}

      {status === 'done' && result && (
        <div className="mt-4 space-y-2.5">
          {result.rejectedCount > 0 && (
            <p className="text-xs text-brass-300">
              {result.rejectedCount} {messages.extractRejectedSummary}
            </p>
          )}
          {proposals.length === 0 && <p className="text-sm text-white/50">{messages.extractNoProposals}</p>}
          {proposals.map((field) => {
            const isAccepted = accepted.has(field.id);
            const hasExistingValue = Boolean(currentValues[field.id]);
            return (
              <div key={field.id} className="animate-rise-in rounded border border-line bg-ink-800 p-3">
                <p className="text-sm font-medium text-white/85">{labelFor(fields, field.id)}</p>
                <p className="text-sm text-white">{field.value}</p>
                {field.quote && (
                  <blockquote className="mt-1.5 rounded border border-brass-500/25 bg-brass-500/[0.07] px-2.5 py-1.5 text-xs italic text-white/60">
                    {messages.extractQuoteLabel} "{field.quote}"
                  </blockquote>
                )}
                {hasExistingValue && !isAccepted && <p className="mt-1.5 text-xs text-brass-300">{messages.extractOverwriteWarning}</p>}
                <div className="mt-2.5 flex gap-2">
                  <button type="button" disabled={isAccepted} onClick={() => handleAccept(field)} className={buttonSecondary}>
                    {isAccepted ? messages.extractAccepted : messages.extractAccept}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
