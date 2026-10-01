import { useRef, useState } from 'react';
import { readDocx } from '../core/docx/read';
import { detectBlanks } from '../core/import/detect';
import { generateTemplate } from '../core/import/generate';
import type { GenerateProblem } from '../core/import/generate';
import { inferFields } from '../core/import/infer';
import type { InferredBlank, InferredField } from '../core/import/infer';
import { findSensitive, looksFilled } from '../core/import/safeguard';
import { TAG_TYPES } from '../core/tags/types';
import type { TagType } from '../core/tags/types';
import { buttonPrimary, buttonSecondary } from './buttonStyles';
import { saveDocx } from './download';
import { saveJson } from './draft';
import { messages } from './messages.pt';
import type { TemplateManifestEntry } from './templateManifest';

interface ImportPanelProps {
  /** Hands the generated template to the normal fill-in flow (never persisted). */
  onUse: (entry: TemplateManifestEntry) => void;
}

interface Analysis {
  bytes: Uint8Array;
  blanks: InferredBlank[];
  fields: InferredField[];
  skippedChoices: number;
  looksFilled: boolean;
}

const inputStyles =
  'w-full rounded border border-line bg-ink-900 px-2 py-1 text-sm text-white transition-colors duration-150 ease-out-quart focus:border-brass-400';

function slugify(s: string): string {
  const slug = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'minuta';
}

export function ImportPanel({ onUse }: ImportPanelProps) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'reading' | 'error' | 'ready'>('idle');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [fields, setFields] = useState<InferredField[]>([]);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [title, setTitle] = useState('');
  const [problems, setProblems] = useState<GenerateProblem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File): Promise<void> {
    setStatus('reading');
    setProblems([]);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = readDocx(bytes);
      const texts = doc.paragraphs.map((p) => p.text);
      const { blanks, skippedChoices } = detectBlanks(texts);
      if (blanks.length === 0) {
        setAnalysis(null);
        setStatus('error');
        setProblems([{ code: 'NO_BLANKS', message: messages.importNoBlanks }]);
        return;
      }
      const inferred = inferFields(blanks);
      setAnalysis({
        bytes,
        blanks: inferred.blanks,
        fields: inferred.fields,
        skippedChoices,
        looksFilled: looksFilled(findSensitive(texts.join('\n'))),
      });
      setFields(inferred.fields);
      setExcluded(new Set());
      setTitle(file.name.replace(/\.docx$/i, ''));
      setStatus('ready');
    } catch {
      setAnalysis(null);
      setStatus('error');
      setProblems([{ code: 'READ_ERROR', message: messages.importReadError }]);
    }
  }

  function patchField(key: string, patch: Partial<InferredField>): void {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function toggleExcluded(key: string): void {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function build() {
    if (!analysis) return null;
    const result = generateTemplate({
      bytes: analysis.bytes,
      blanks: analysis.blanks,
      fields,
      excluded,
      title: title.trim() || messages.importCustomCode,
      templateId: slugify(title),
    });
    setProblems(result.problems);
    if (!result.docxBytes || !result.meta) return null;
    return { docxBytes: result.docxBytes, meta: result.meta };
  }

  function handleUse(): void {
    const built = build();
    if (!built) return;
    const copy = built.docxBytes.slice().buffer;
    onUse({
      slug: built.meta.id,
      title: built.meta.title,
      code: messages.importCustomCode,
      docxUrl: '',
      docxBytes: copy,
      metaRaw: built.meta,
    });
  }

  function handleDownload(): void {
    const built = build();
    if (!built) return;
    saveDocx(built.docxBytes.slice().buffer, `${built.meta.id}.docx`);
    saveJson(JSON.stringify(built.meta, null, 2), `${built.meta.id}.meta.json`);
  }

  const includedCount = fields.filter((f) => !excluded.has(f.key)).length;

  return (
    <section
      className="animate-rise-in w-full max-w-3xl rounded-lg border border-brass-500/40 bg-ink-900 p-5 shadow-[0_0_0_1px_rgba(201,154,92,0.08),0_20px_60px_-30px_rgba(201,154,92,0.35)] sm:p-8"
      aria-labelledby="import-heading"
    >
      <h2 id="import-heading" className="font-display text-2xl font-semibold text-white sm:text-3xl">
        {messages.importTitle}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">{messages.importHint}</p>

      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {[messages.importStep1, messages.importStep2, messages.importStep3].map((step, i) => (
          <li key={step} className="flex items-start gap-3 text-sm text-white/80">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brass-400 font-mono text-xs text-brass-300"
            >
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        aria-label={messages.importChooseFile}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (!file) return;
          if (/\.docx$/i.test(file.name)) {
            void handleFile(file);
          } else {
            setStatus('error');
            setProblems([{ code: 'WRONG_TYPE', message: messages.importWrongType }]);
          }
        }}
        className={`mt-6 flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors duration-150 ease-out-quart ${
          dragging ? 'border-brass-400 bg-brass-500/10' : 'border-line-strong bg-ink-950/40'
        }`}
      >
        <p className="font-display text-lg text-white">{messages.importDropTitle}</p>
        <button type="button" onClick={() => fileInputRef.current?.click()} className={buttonPrimary}>
          {messages.importChooseFile}
        </button>
        <p className="font-mono text-xs text-white/50">{messages.importExample}</p>
        <p className="text-xs text-white/50">{messages.importLocalOnly}</p>
      </div>

      {status === 'reading' && <p className="mt-3 text-sm text-white/70">{messages.importReading}</p>}

      {status === 'error' && problems.length > 0 && (
        <p role="alert" className="mt-3 text-sm text-rubric-400">
          {problems[0]?.message}
        </p>
      )}

      {status === 'ready' && analysis && (
        <div className="mt-4">
          {analysis.looksFilled && (
            <p role="alert" className="mb-3 rounded border border-rubric-400 p-2 text-xs text-rubric-400">
              {messages.importFilledWarning}
            </p>
          )}
          {analysis.skippedChoices > 0 && (
            <p className="mb-3 text-xs text-white/60">
              {messages.importSkippedChoices} {analysis.skippedChoices}
            </p>
          )}

          <label htmlFor="import-title" className="block text-xs font-medium text-white/70">
            {messages.importTemplateTitle}
          </label>
          <input id="import-title" value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputStyles} mb-4 mt-1`} />

          <h3 className="mb-2 font-display text-sm font-semibold text-white/90">
            {messages.importFieldsHeading} ({includedCount}/{fields.length})
          </h3>
          <ul className="flex flex-col gap-3">
            {fields.map((f) => {
              const count = analysis.blanks.filter((b) => b.fieldKey === f.key).length;
              const off = excluded.has(f.key);
              return (
                <li key={f.key} className={`rounded border border-line p-3 ${off ? 'opacity-50' : ''}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-white/80">
                      <input type="checkbox" checked={!off} onChange={() => toggleExcluded(f.key)} />
                      {messages.importInclude}
                    </label>
                    <span className="font-mono text-[11px] text-white/40">
                      {count} {messages.importOccurrences}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-xs text-white/60">
                      {messages.importLabelField}
                      <input
                        value={f.label}
                        disabled={off}
                        onChange={(e) => patchField(f.key, { label: e.target.value })}
                        className={`${inputStyles} mt-1`}
                      />
                    </label>
                    <label className="text-xs text-white/60">
                      {messages.importIdField}
                      <input
                        value={f.id}
                        disabled={off}
                        onChange={(e) => patchField(f.key, { id: e.target.value })}
                        className={`${inputStyles} mt-1 font-mono`}
                      />
                    </label>
                    <label className="text-xs text-white/60">
                      {messages.importTypeField}
                      <select
                        value={f.type}
                        disabled={off}
                        onChange={(e) => patchField(f.key, { type: e.target.value as TagType })}
                        className={`${inputStyles} mt-1`}
                      >
                        {TAG_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-white/60">
                      {messages.importGroupField}
                      <input
                        value={f.group}
                        disabled={off}
                        onChange={(e) => patchField(f.key, { group: e.target.value })}
                        className={`${inputStyles} mt-1`}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>

          {problems.length > 0 && (
            <div role="alert" className="mt-3 text-xs text-rubric-400">
              <p className="font-medium">{messages.importProblemsHeading}</p>
              <ul className="list-disc pl-5">
                {problems.map((p, i) => (
                  <li key={`${p.code}-${i}`}>{p.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={handleUse} disabled={includedCount === 0} className={buttonPrimary}>
              {messages.importUse}
            </button>
            <button type="button" onClick={handleDownload} disabled={includedCount === 0} className={buttonSecondary}>
              {messages.importDownload}
            </button>
          </div>
          {includedCount === 0 && <p className="mt-2 text-xs text-white/50">{messages.importNoFields}</p>}
        </div>
      )}
    </section>
  );
}
