import { useState } from 'react';
import { AnthropicProvider } from '../llm/anthropicProvider';
import { runExtraction } from '../llm/extract';
import type { ExtractFieldSpec, ExtractResult, GroundedField } from '../llm/types';
import { messages } from './messages.pt';

interface ExtractPanelProps {
  templateId: string;
  fields: ExtractFieldSpec[];
  currentValues: Record<string, string>;
  /** Applies one field's value — same setter the main form uses; never called except on explicit per-field accept. */
  onAcceptField: (id: string, value: string) => void;
}

const MAX_TEXT_CHARS = 20_000;

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
      <button type="button" onClick={() => setOpen(true)} className="mb-4 text-sm text-blue-700 underline">
        {messages.extractPanelToggleOpen}
      </button>
    );
  }

  return (
    <section className="mb-4 rounded border border-slate-300 p-3" aria-label={messages.extractPanelToggleOpen}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{messages.extractPanelToggleOpen}</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 underline">
          {messages.extractPanelToggleClose}
        </button>
      </div>

      <p className="mb-2 text-xs text-slate-600">{messages.extractDisclaimer}</p>

      <label htmlFor="extract-api-key" className="block text-xs font-medium">
        {messages.extractApiKeyLabel}
      </label>
      <input
        id="extract-api-key"
        type="password"
        autoComplete="off"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder={messages.extractApiKeyPlaceholder}
        className="mb-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <p className="mb-2 text-xs text-slate-500">{messages.extractApiKeyHelp}</p>

      <label htmlFor="extract-text" className="block text-xs font-medium">
        {messages.extractTextLabel}
      </label>
      <textarea
        id="extract-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_TEXT_CHARS}
        rows={6}
        className="mb-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <p className="mb-2 text-xs text-slate-500">{messages.extractTextHelp}</p>

      <button
        type="button"
        disabled={!apiKey || !text || status === 'loading'}
        onClick={() => void handleSubmit()}
        className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {status === 'loading' ? messages.extractSubmitting : messages.extractSubmit}
      </button>

      {status === 'error' && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {errorMessage || messages.extractErrorGeneric}
        </p>
      )}

      {status === 'done' && result && (
        <div className="mt-3 space-y-2">
          {result.rejectedCount > 0 && (
            <p className="text-xs text-amber-700">
              {result.rejectedCount} {messages.extractRejectedSummary}
            </p>
          )}
          {proposals.length === 0 && <p className="text-sm text-slate-600">{messages.extractNoProposals}</p>}
          {proposals.map((field) => {
            const isAccepted = accepted.has(field.id);
            const hasExistingValue = Boolean(currentValues[field.id]);
            return (
              <div key={field.id} className="rounded border border-slate-200 p-2">
                <p className="text-sm font-medium">{labelFor(fields, field.id)}</p>
                <p className="text-sm">{field.value}</p>
                {field.quote && (
                  <blockquote className="mt-1 border-l-2 border-amber-400 bg-amber-50 px-2 py-1 text-xs italic text-slate-700">
                    {messages.extractQuoteLabel} “{field.quote}”
                  </blockquote>
                )}
                {hasExistingValue && !isAccepted && <p className="mt-1 text-xs text-amber-700">{messages.extractOverwriteWarning}</p>}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={isAccepted}
                    onClick={() => handleAccept(field)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  >
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
