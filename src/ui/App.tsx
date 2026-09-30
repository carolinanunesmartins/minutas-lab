import { useEffect, useMemo, useRef, useState } from 'react';
import { readDocx } from '../core/docx/read';
import { parseTemplate } from '../core/tags/parse';
import { collectFieldTypes, collectUsedFieldIds } from '../core/template/fields';
import { loadTemplateMeta } from '../core/template/meta';
import type { Meta } from '../core/template/meta';
import { validateTemplateValues } from '../core/template/validate';
import type { ValidationResult } from '../core/template/validate';
import { BuildClient } from './buildClient';
import { buttonPrimary, buttonSecondary } from './buttonStyles';
import { ExtractPanel } from './ExtractPanel';
import { Form } from './Form';
import { Preview } from './Preview';
import { buildFieldGroups, toExtractFieldSpecs } from './fieldModel';
import type { FieldGroup } from './fieldModel';
import { saveDocx } from './download';
import { messages } from './messages.pt';
import { TEMPLATE_MANIFEST } from './templateManifest';
import type { TemplateManifestEntry } from './templateManifest';

type AppState = 'empty' | 'loading' | 'error' | 'ready';

interface LoadedTemplate {
  templateBytes: ArrayBuffer;
  groups: FieldGroup[];
  meta: Meta;
}

function initialValues(meta: Meta): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [id, field] of Object.entries(meta.fields)) {
    if (field.default !== undefined) values[id] = field.default;
  }
  return values;
}

function App() {
  const [state, setState] = useState<AppState>('empty');
  const [selected, setSelected] = useState<TemplateManifestEntry | null>(null);
  const [loaded, setLoaded] = useState<LoadedTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [activeFieldId, setActiveFieldId] = useState<string | undefined>(undefined);
  const [previewBytes, setPreviewBytes] = useState<ArrayBuffer | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const buildClientRef = useRef<BuildClient | null>(null);
  const previewTokenRef = useRef(0);

  useEffect(() => {
    buildClientRef.current = new BuildClient();
    return () => buildClientRef.current?.terminate();
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setState('loading');
    setPreviewBytes(null);
    void (async () => {
      try {
        const response = await fetch(selected.docxUrl);
        const templateBytes = await response.arrayBuffer();
        const doc = readDocx(new Uint8Array(templateBytes));
        const rawBody = doc.paragraphs.map((p) => ({ location: 'body' as const, text: p.text }));
        const { paragraphs } = parseTemplate(rawBody);
        const fieldTypes = collectFieldTypes(paragraphs);
        const usedIds = collectUsedFieldIds(paragraphs);
        const { meta } = loadTemplateMeta(selected.metaRaw, usedIds);
        if (!meta) throw new Error('invalid template.meta.json');
        const groups = buildFieldGroups(usedIds, fieldTypes, meta, messages.groupUnlabeled);
        if (cancelled) return;
        setLoaded({ templateBytes, groups, meta });
        setValues(initialValues(meta));
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const validation = useMemo<ValidationResult | null>(() => {
    if (!loaded) return null;
    const rawBody = new Uint8Array(loaded.templateBytes);
    const doc = readDocx(rawBody);
    const rawBodyParagraphs = doc.paragraphs.map((p) => ({ location: 'body' as const, text: p.text }));
    const { paragraphs, errors } = parseTemplate(rawBodyParagraphs);
    const fieldTypes = collectFieldTypes(paragraphs);
    const todayIso = new Date().toISOString().slice(0, 10);
    return validateTemplateValues({ paragraphs, meta: loaded.meta, fieldTypes, values, todayIso, tagErrors: errors });
  }, [loaded, values]);

  const extractFields = useMemo(() => (loaded ? toExtractFieldSpecs(loaded.groups) : []), [loaded]);

  // Debounced live preview (SPEC.md §7: 50-100ms).
  useEffect(() => {
    if (!loaded || !buildClientRef.current) return;
    const token = previewTokenRef.current + 1;
    previewTokenRef.current = token;
    const timer = setTimeout(() => {
      const options: Parameters<BuildClient['build']>[0] = {
        templateBytes: loaded.templateBytes,
        values,
        disclaimerText: messages.disclaimer,
        shading: activeFieldId !== undefined ? { activeFieldId } : {},
      };
      buildClientRef.current
        ?.build(options)
        .then((bytes) => {
          if (previewTokenRef.current !== token) return;
          setPreviewBytes(bytes);
        })
        .catch((err: unknown) => {
          console.error('preview build failed', err);
        });
    }, 75);
    return () => clearTimeout(timer);
  }, [loaded, values, activeFieldId]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (Object.values(values).some((v) => v)) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [values]);

  function handleChange(id: string, value: string): void {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  function handleChangeTemplate(): void {
    setSelected(null);
    setLoaded(null);
    setValues({});
    setPreviewBytes(null);
    setState('empty');
  }

  async function handleDownloadDraft(): Promise<void> {
    if (!loaded || !buildClientRef.current) return;
    const bytes = await buildClientRef.current.build({
      templateBytes: loaded.templateBytes,
      values,
      disclaimerText: messages.disclaimer,
      draftNote: messages.draftNote,
      shading: {},
    });
    saveDocx(bytes, `${loaded.meta.id}-rascunho.docx`);
  }

  async function handleConfirmDownloadFinal(): Promise<void> {
    if (!loaded || !buildClientRef.current) return;
    const bytes = await buildClientRef.current.build({
      templateBytes: loaded.templateBytes,
      values,
      disclaimerText: messages.disclaimer,
    });
    saveDocx(bytes, `${loaded.meta.id}.docx`);
    setReviewOpen(false);
  }

  if (state === 'empty') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-display text-3xl font-semibold text-white sm:text-4xl">{messages.appTitle}</h1>
          <h2 className="font-display text-lg text-white/80">{messages.pickTemplateTitle}</h2>
          <p className="max-w-sm text-sm text-white/50">{messages.pickTemplateHint}</p>
        </div>
        <ul className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
          {TEMPLATE_MANIFEST.map((entry, i) => (
            <li key={entry.slug} className="animate-rise-in" style={{ animationDelay: `${i * 60}ms` }}>
              <button
                type="button"
                onClick={() => setSelected(entry)}
                className="group flex w-full flex-col items-start gap-2 rounded-md border border-paper-line bg-paper p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.5)] transition-transform duration-200 ease-out-quart hover:-translate-y-0.5 focus-visible:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
              >
                <span aria-hidden="true" className="font-mono text-[11px] uppercase tracking-wider text-brass-ink">
                  {entry.code}
                </span>
                <span className="font-display text-lg font-semibold leading-snug text-paper-ink">{entry.title}</span>
                <span className="mt-1 h-px w-8 bg-brass-500 transition-all duration-200 ease-out-quart group-hover:w-16" />
              </button>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  if (state === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-display text-white/70">{messages.loading}</p>
      </main>
    );
  }

  if (state === 'error' || !loaded || !validation) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p role="alert" className="text-rubric-400">
          {messages.loadError}
        </p>
        <button type="button" onClick={handleChangeTemplate} className={buttonSecondary}>
          {messages.changeTemplate}
        </button>
      </main>
    );
  }

  const canDownloadFinal = !validation.hasBlockingError;

  return (
    <main className="flex min-h-screen flex-col bg-ink-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-400">{messages.appTitle}</p>
          <h1 className="font-display text-lg font-semibold text-white">{loaded.meta.title}</h1>
        </div>
        <button type="button" onClick={handleChangeTemplate} className={buttonSecondary}>
          {messages.changeTemplate}
        </button>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <section className="lg:w-1/2 overflow-auto bg-ink-950 p-4 sm:p-6" aria-labelledby="form-heading">
          <h2 id="form-heading" className="sr-only">
            {messages.formTitle}
          </h2>
          {validation.structuralErrors.length > 0 && (
            <p role="alert" className="mb-4 rounded border border-rubric-500/40 bg-rubric-tint p-3 text-sm text-rubric-400">
              {messages.structuralErrorsTitle}
            </p>
          )}
          <ExtractPanel templateId={loaded.meta.id} fields={extractFields} currentValues={values} onAcceptField={handleChange} />
          <Form
            groups={loaded.groups}
            values={values}
            fieldIssues={validation.fieldIssues}
            activeFieldId={activeFieldId}
            onChange={handleChange}
            onFocusField={setActiveFieldId}
          />
        </section>

        <section
          className="flex flex-col border-t border-line bg-ink-900 lg:w-1/2 lg:border-l lg:border-t-0"
          aria-labelledby="preview-heading"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5 sm:px-6">
            <h2 id="preview-heading" className="font-display text-sm font-semibold text-white/90">
              {messages.previewTitle}
            </h2>
            <p className="text-xs text-white/40">{messages.previewApprox}</p>
          </div>
          <div className="h-[60vh] flex-1 overflow-hidden bg-ink-900 p-3 sm:p-6 lg:h-[calc(100vh-8rem)]">
            <div className="h-full overflow-hidden rounded-sm shadow-[0_8px_30px_rgba(0,0,0,0.55)]">
              <Preview bytes={previewBytes} />
            </div>
          </div>
        </section>
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-line bg-ink-950 px-4 py-3 sm:px-6">
        <button type="button" onClick={() => void handleDownloadDraft()} className={buttonSecondary}>
          {messages.downloadDraft}
        </button>
        <button
          type="button"
          disabled={!canDownloadFinal}
          title={canDownloadFinal ? undefined : messages.downloadDisabledReason}
          onClick={() => setReviewOpen(true)}
          className={buttonPrimary}
        >
          {messages.downloadFinal}
        </button>
      </footer>

      {reviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-heading"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 backdrop-blur-sm"
        >
          <div className="animate-pop-in w-full max-w-md rounded-md border border-line bg-ink-900 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <h2 id="review-heading" className="font-display text-lg font-semibold text-white">
              {messages.reviewTitle}
            </h2>
            <p className="mt-2 text-sm text-white/60">{messages.reviewBody}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setReviewOpen(false)} className={buttonSecondary}>
                {messages.reviewCancel}
              </button>
              <button type="button" onClick={() => void handleConfirmDownloadFinal()} className={buttonPrimary}>
                {messages.reviewConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
