import { useRef, useState } from 'react';
import { readDocx } from '../core/docx/read';
import { detectBlanks } from '../core/import/detect';
import { generateTemplate } from '../core/import/generate';
import type { GenerateProblem } from '../core/import/generate';
import { inferFields } from '../core/import/infer';
import { parseTemplate } from '../core/tags/parse';
import { collectUsedFieldIds } from '../core/template/fields';
import { loadTemplateMeta } from '../core/template/meta';
import type { InferredBlank, InferredField } from '../core/import/infer';
import { findSensitive, looksFilled } from '../core/import/safeguard';
import { TAG_TYPES } from '../core/tags/types';
import type { TagType } from '../core/tags/types';
import { buttonPrimary, buttonSecondary } from './buttonStyles';
import { saveDocx } from './download';
import sampleUrl from '../../fixtures/sample-minuta-lacunas.docx?url';
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

const TYPE_HINTS: Record<TagType, string> = {
  text: messages.typeHint_text,
  nif: messages.typeHint_nif,
  nipc: messages.typeHint_nipc,
  iban: messages.typeHint_iban,
  cc: messages.typeHint_cc,
  data: messages.typeHint_data,
  eur: messages.typeHint_eur,
  int: messages.typeHint_int,
};

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
  const reopenInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File): Promise<void> {
    setStatus('reading');
    setProblems([]);
    try {
      analyze(new Uint8Array(await file.arrayBuffer()), file.name);
    } catch {
      showReadError();
    }
  }

  async function handleSample(): Promise<void> {
    setStatus('reading');
    setProblems([]);
    try {
      const response = await fetch(sampleUrl);
      analyze(new Uint8Array(await response.arrayBuffer()), 'minuta-de-exemplo.docx');
    } catch {
      showReadError();
    }
  }

  function showReadError(): void {
    setAnalysis(null);
    setStatus('error');
    setProblems([{ code: 'READ_ERROR', message: messages.importReadError }]);
  }

  /** Opens a minuta created here before: its .docx (with {{tags}}) plus its .json (field labels, groups, options). */
  async function handleReopen(files: FileList): Promise<void> {
    setProblems([]);
    try {
      const list = Array.from(files);
      const docx = list.find((f) => /\.docx$/i.test(f.name));
      const json = list.find((f) => /\.json$/i.test(f.name));
      if (!docx || !json) throw new Error('need both files');
      const bytes = new Uint8Array(await docx.arrayBuffer());
      const metaRaw: unknown = JSON.parse(await json.text());
      const doc = readDocx(bytes);
      const { paragraphs, errors } = parseTemplate(doc.paragraphs.map((p) => ({ location: 'body' as const, text: p.text })));
      const { meta, errors: metaErrors } = loadTemplateMeta(metaRaw, collectUsedFieldIds(paragraphs));
      if (errors.length > 0 || metaErrors.length > 0 || !meta) throw new Error('invalid template');
      onUse({ slug: meta.id, title: meta.title, code: messages.importCustomCode, docxUrl: '', docxBytes: bytes.slice().buffer, metaRaw: meta });
    } catch {
      setAnalysis(null);
      setStatus('error');
      setProblems([{ code: 'REOPEN_ERROR', message: messages.importReopenError }]);
    }
  }

  function analyze(bytes: Uint8Array, fileName: string): void {
    try {
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
      setTitle(fileName.replace(/\.docx$/i, ''));
      setStatus('ready');
    } catch {
      showReadError();
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
    <section className="animate-rise-in flex w-full max-w-xl flex-col items-center gap-6" aria-labelledby="import-heading">
      <h2 id="import-heading" className="sr-only">
        {messages.importTitle}
      </h2>

      <div className="flex flex-col items-center gap-2 text-center">
        <button
          type="button"
          onClick={() => void handleSample()}
          className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg text-center bg-brass-500 px-8 py-4 font-display text-lg font-semibold text-brass-ink shadow-[0_10px_40px_-10px_rgba(201,154,92,0.6)] transition-[transform,background-color] duration-150 ease-out-quart hover:bg-brass-400 active:scale-[0.98] sm:text-xl"
        >
          {messages.importSample}
          <span aria-hidden="true">→</span>
        </button>
        <p className="text-sm text-white/65">{messages.importSampleHint}</p>
      </div>

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
        className={`flex w-full flex-col items-center gap-3 rounded-lg border border-dashed px-5 py-5 text-center transition-colors duration-150 ease-out-quart sm:flex-row sm:justify-between sm:text-left ${
          dragging ? 'border-brass-400 bg-brass-500/10' : 'border-line-strong'
        }`}
      >
        <p className="text-sm text-white/70">{messages.importDropTitle}</p>
        <button type="button" onClick={() => fileInputRef.current?.click()} className={buttonSecondary}>
          {messages.importChooseFile}
        </button>
      </div>

      <input
        ref={reopenInputRef}
        type="file"
        multiple
        accept=".docx,.json,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        aria-label={messages.importReopen}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) void handleReopen(e.target.files);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => reopenInputRef.current?.click()}
        title={messages.importReopenHint}
        className="min-h-11 text-xs text-white/60 underline underline-offset-2 hover:text-white sm:min-h-0"
      >
        {messages.importReopen}
      </button>

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

          <div className="mb-4 rounded-md border border-brass-500/30 bg-brass-500/[0.06] p-3">
            <h3 className="font-display text-sm font-semibold text-brass-300">{messages.importSummaryHeading}</h3>
            <ul className="mt-2 grid gap-1 text-sm text-white/85 sm:grid-cols-2">
              <li>
                <strong>{analysis.blanks.length}</strong> {messages.importSummaryBlanks}
              </li>
              <li>
                <strong>{fields.length}</strong> {messages.importSummaryFields}
              </li>
              <li>
                <strong>{Math.max(0, analysis.blanks.length - fields.length)}</strong> {messages.importSummaryRepeats}
              </li>
              <li>
                <strong>{fields.filter((f) => f.type !== 'text').length}</strong> {messages.importSummaryTyped}
              </li>
            </ul>
            <p className="mt-2 text-xs text-white/65">{messages.importLimits}</p>
          </div>

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
                    <span className="font-mono text-[11px] text-white/60">
                      {count} {count === 1 ? messages.importOccurrence : messages.importOccurrences}
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
                      <span className="mt-1 block text-[11px] text-white/60">{TYPE_HINTS[f.type]}</span>
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
          {includedCount === 0 && <p className="mt-2 text-xs text-white/60">{messages.importNoFields}</p>}
        </div>
      )}
    </section>
  );
}
