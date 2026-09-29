import { useEffect, useMemo, useRef, useState } from 'react';
import templateUrl from '../../templates/cpcv/template.docx?url';
import templateMetaRaw from '../../templates/cpcv/template.meta.json';
import { readDocx } from '../core/docx/read';
import { parseTemplate } from '../core/tags/parse';
import { collectFieldTypes, collectUsedFieldIds } from '../core/template/fields';
import { loadTemplateMeta } from '../core/template/meta';
import type { Meta } from '../core/template/meta';
import { validateTemplateValues } from '../core/template/validate';
import type { ValidationResult } from '../core/template/validate';
import { BuildClient } from './buildClient';
import { Form } from './Form';
import { Preview } from './Preview';
import { buildFieldGroups } from './fieldModel';
import type { FieldGroup } from './fieldModel';
import { saveDocx } from './download';
import { messages } from './messages.pt';

type AppState = 'loading' | 'error' | 'ready';

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
  const [state, setState] = useState<AppState>('loading');
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
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(templateUrl);
        const templateBytes = await response.arrayBuffer();
        const doc = readDocx(new Uint8Array(templateBytes));
        const rawBody = doc.paragraphs.map((p) => ({ location: 'body' as const, text: p.text }));
        const { paragraphs } = parseTemplate(rawBody);
        const fieldTypes = collectFieldTypes(paragraphs);
        const usedIds = collectUsedFieldIds(paragraphs);
        const { meta } = loadTemplateMeta(templateMetaRaw, usedIds);
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
  }, []);

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

  if (state === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>{messages.loading}</p>
      </main>
    );
  }

  if (state === 'error' || !loaded || !validation) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="alert" className="text-red-600">
          {messages.loadError}
        </p>
      </main>
    );
  }

  const canDownloadFinal = !validation.hasBlockingError;

  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 px-4 py-3">
        <h1 className="text-lg font-semibold">{messages.appTitle}</h1>
        <p className="text-sm text-slate-600">{messages.appTagline}</p>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <section className="lg:w-1/2 overflow-auto p-4" aria-labelledby="form-heading">
          <h2 id="form-heading" className="sr-only">
            {messages.formTitle}
          </h2>
          {validation.structuralErrors.length > 0 && (
            <p role="alert" className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">
              {messages.structuralErrorsTitle}
            </p>
          )}
          <Form
            groups={loaded.groups}
            values={values}
            fieldIssues={validation.fieldIssues}
            activeFieldId={activeFieldId}
            onChange={handleChange}
            onFocusField={setActiveFieldId}
          />
        </section>

        <section className="lg:w-1/2 border-t border-slate-200 lg:border-l lg:border-t-0" aria-labelledby="preview-heading">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
            <h2 id="preview-heading" className="text-sm font-semibold">
              {messages.previewTitle}
            </h2>
            <p className="text-xs text-slate-500">{messages.previewApprox}</p>
          </div>
          <div className="h-[60vh] lg:h-[calc(100vh-8rem)]">
            <Preview bytes={previewBytes} />
          </div>
        </section>
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
        <button type="button" onClick={() => void handleDownloadDraft()} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
          {messages.downloadDraft}
        </button>
        <button
          type="button"
          disabled={!canDownloadFinal}
          title={canDownloadFinal ? undefined : messages.downloadDisabledReason}
          onClick={() => setReviewOpen(true)}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {messages.downloadFinal}
        </button>
      </footer>

      {reviewOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="review-heading" className="fixed inset-0 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded bg-white p-4">
            <h2 id="review-heading" className="text-base font-semibold">
              {messages.reviewTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-700">{messages.reviewBody}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setReviewOpen(false)} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
                {messages.reviewCancel}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDownloadFinal()}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
              >
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
