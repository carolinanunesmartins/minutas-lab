import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readDocx } from '../core/docx/read';
import { parseTemplate } from '../core/tags/parse';
import { collectFieldCounts, collectFieldTypes, collectUsedFieldIds } from '../core/template/fields';
import { loadTemplateMeta } from '../core/template/meta';
import type { Meta } from '../core/template/meta';
import { validateTemplateValues } from '../core/template/validate';
import type { ValidationResult } from '../core/template/validate';
import { BuildClient } from './buildClient';
import { buttonGhost, buttonPrimary, buttonSecondary } from './buttonStyles';
import { dummyValuesFor } from './dummyData';
import { parseDraft, saveJson, serializeDraft } from './draft';
import { fieldIssueMessage, ruleIssueMessage } from './issueMessages';
import { Form } from './Form';
import { ImportPanel } from './ImportPanel';
import { Preview } from './Preview';
import { buildFieldGroups } from './fieldModel';
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
  // The field the preview rebuilds/scrolls-to for: only set on blur (not
  // focus) so it stays a single build per edit, not two.
  const [lastEditedFieldId, setLastEditedFieldId] = useState<string | undefined>(undefined);
  const [previewBytes, setPreviewBytes] = useState<ArrayBuffer | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [attemptedDownload, setAttemptedDownload] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false); // small screens only
  const [statusMessage, setStatusMessage] = useState('');
  // Fields the user has already left: their format errors show without waiting for the download attempt.
  const [touchedFields, setTouchedFields] = useState<ReadonlySet<string>>(new Set());
  // Bumped on every blocked download so the error summary takes focus each time.
  const [blockedCount, setBlockedCount] = useState(0);
  const errorSummaryRef = useRef<HTMLElement>(null);
  const draftInputRef = useRef<HTMLInputElement>(null);
  // Values as of the last export/download: leaving with anything different from this loses work.
  const savedSnapshotRef = useRef('{}');

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
        const templateBytes = selected.docxBytes ?? (await (await fetch(selected.docxUrl)).arrayBuffer());
        const doc = readDocx(new Uint8Array(templateBytes));
        const rawBody = doc.paragraphs.map((p) => ({ location: 'body' as const, text: p.text }));
        const { paragraphs } = parseTemplate(rawBody);
        const fieldTypes = collectFieldTypes(paragraphs);
        const usedIds = collectUsedFieldIds(paragraphs);
        const { meta } = loadTemplateMeta(selected.metaRaw, usedIds);
        if (!meta) throw new Error('invalid template.meta.json');
        const groups = buildFieldGroups(usedIds, fieldTypes, meta, messages.groupUnlabeled, collectFieldCounts(paragraphs));
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

  // Checkbox fields (block/condition switches) and, per switch, the fields the
  // template requires once it is on (`required_if` rules) — shown under the checkbox.
  const toggleIds = useMemo(
    () => new Set((loaded?.groups ?? []).flatMap((g) => g.fields).filter((f) => f.type === undefined).map((f) => f.id)),
    [loaded],
  );
  const blockDependents = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!loaded) return map;
    const labels = new Map(loaded.groups.flatMap((g) => g.fields).map((f) => [f.id, f.label] as const));
    for (const rule of loaded.meta.rules ?? []) {
      if (rule.type !== 'required_if') continue;
      map.set(rule.when.field, [...(map.get(rule.when.field) ?? []), labels.get(rule.field) ?? rule.field]);
    }
    return map;
  }, [loaded]);

  // Latest `values` without making the preview effect below re-run on every
  // keystroke (see that effect's comment for why).
  const valuesRef = useRef(values);
  valuesRef.current = values;

  useEffect(() => {
    if (!reviewOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setReviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reviewOpen]);

  // A blocked download moves focus to the error summary (WCAG: summary links to each problem).
  useEffect(() => {
    if (blockedCount === 0) return;
    errorSummaryRef.current?.focus();
    errorSummaryRef.current?.scrollIntoView({ block: 'nearest' });
  }, [blockedCount]);

  // Rebuilds the docx-preview on blur only (not per keystroke, not on focus
  // either) — one worker round-trip per edit. `handleChange` still updates
  // `values` immediately so each input stays a normal controlled field; only
  // the *preview* lags behind until the user leaves the field. This is
  // called directly from the blur handler below rather than from a `values`-
  // or `activeFieldId`-keyed effect: re-editing the *same* field twice in a
  // row leaves those values unchanged, and an effect wouldn't re-run for an
  // unchanged dependency — an explicit call always fires.
  const buildPreview = useCallback(
    (fieldIdForShading: string | undefined) => {
      if (!loaded || !buildClientRef.current) return;
      const token = previewTokenRef.current + 1;
      previewTokenRef.current = token;
      const options: Parameters<BuildClient['build']>[0] = {
        templateBytes: loaded.templateBytes,
        values: valuesRef.current,
        disclaimerText: messages.disclaimer,
        shading: fieldIdForShading !== undefined ? { anchors: true, activeFieldId: fieldIdForShading } : { anchors: true },
      };
      buildClientRef.current
        .build(options)
        .then((bytes) => {
          if (previewTokenRef.current !== token) return;
          setPreviewBytes(bytes);
        })
        .catch((err: unknown) => {
          console.error('preview build failed', err);
        });
    },
    [loaded],
  );

  // Initial preview as soon as a template (with its default values) loads.
  useEffect(() => {
    buildPreview(undefined);
  }, [buildPreview]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const hasUnsaved = Object.values(values).some((v) => v) && JSON.stringify(values) !== savedSnapshotRef.current;
      if (hasUnsaved) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [values]);

  function handleChange(id: string, value: string): void {
    const next = { ...valuesRef.current, [id]: value };
    valuesRef.current = next;
    setValues(next);
    // A checkbox is a discrete choice that adds/removes a whole clause: show
    // the result at once (and jump to it) instead of waiting for blur.
    if (toggleIds.has(id)) {
      setLastEditedFieldId(id);
      buildPreview(id);
    }
  }

  function markSaved(): void {
    savedSnapshotRef.current = JSON.stringify(valuesRef.current);
  }

  function handleExportDraft(): void {
    if (!loaded) return;
    saveJson(serializeDraft(loaded.meta.id, loaded.meta.version, valuesRef.current), `${loaded.meta.id}-dados.json`);
    markSaved();
    announce(messages.draftSaved);
  }

  async function handleImportDraft(file: File | undefined): Promise<void> {
    if (!file || !loaded) return;
    const known = new Set(loaded.groups.flatMap((g) => g.fields).map((f) => f.id));
    if (file.size > 512 * 1024) {
      announce(messages.draftErrors['too-large']);
      return;
    }
    const result = parseDraft(await file.text(), loaded.meta.id, known);
    if (!result.ok) {
      announce(messages.draftErrors[result.error]);
      return;
    }
    const next = { ...initialValues(loaded.meta), ...result.values };
    valuesRef.current = next;
    setValues(next);
    setTouchedFields(new Set());
    setAttemptedDownload(false);
    setLastEditedFieldId(undefined);
    markSaved();
    buildPreview(undefined);
    announce(result.ignored > 0 ? `${messages.draftImported} (${result.ignored} ${messages.draftIgnored})` : messages.draftImported);
  }

  function announce(message: string): void {
    setStatusMessage(message);
    window.setTimeout(() => setStatusMessage(''), 4000);
  }

  // Preview -> form: jump to the clicked field's input and focus it.
  function handleFieldClick(id: string): void {
    const input = document.getElementById(`field-${id}`);
    if (!input) return;
    // A collapsed accordion group can't take focus.
    input.closest('details')?.setAttribute('open', '');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    input.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    input.focus({ preventScroll: true });
  }

  function handleFocusField(id: string | undefined): void {
    if (id === undefined && activeFieldId !== undefined) {
      setTouchedFields((prev) => (prev.has(activeFieldId) ? prev : new Set(prev).add(activeFieldId)));
      setLastEditedFieldId(activeFieldId);
      buildPreview(activeFieldId);
    }
    setActiveFieldId(id);
  }

  // Demo aid: fills every field with fictitious, format-valid data, then refreshes the preview.
  function handleFillDummy(): void {
    if (!loaded) return;
    const defaults = initialValues(loaded.meta);
    // Only what the user typed counts: template defaults are not "their" data.
    const hasTypedValues = Object.entries(valuesRef.current).some(([id, v]) => v.trim() !== '' && v !== defaults[id]);
    if (hasTypedValues && !window.confirm(messages.fillDummyConfirm)) return;
    const dummy = { ...defaults, ...dummyValuesFor(loaded.meta.id) };
    valuesRef.current = dummy;
    setValues(dummy);
    // Sample data is not the user's work: leaving the page afterwards needs no warning.
    savedSnapshotRef.current = JSON.stringify(dummy);
    buildPreview(undefined);
    announce(messages.fillDummyDone);
  }

  function handleChangeTemplate(): void {
    setSelected(null);
    setLoaded(null);
    setValues({});
    setPreviewBytes(null);
    setAttemptedDownload(false);
    setTouchedFields(new Set());
    setBlockedCount(0);
    setActiveFieldId(undefined);
    setLastEditedFieldId(undefined);
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
    markSaved();
    announce(messages.downloaded);
  }

  async function handleConfirmDownloadFinal(): Promise<void> {
    if (!loaded || !buildClientRef.current) return;
    const bytes = await buildClientRef.current.build({
      templateBytes: loaded.templateBytes,
      values,
      disclaimerText: messages.disclaimer,
    });
    saveDocx(bytes, `${loaded.meta.id}.docx`);
    markSaved();
    setReviewOpen(false);
    announce(messages.downloaded);
  }

  if (state === 'empty') {
    return (
      <main className="flex min-h-screen flex-col items-center gap-12 px-6 py-12 sm:py-16">
        <header className="flex max-w-xl flex-col items-center gap-3 text-center">
          <h1 className="font-display text-3xl font-semibold text-white sm:text-4xl">{messages.appTitle}</h1>
          <p className="text-base text-white/80">{messages.importTagline}</p>
          <p className="text-xs leading-relaxed text-white/50">{messages.privacyNote}</p>
        </header>

        <ImportPanel onUse={setSelected} />

        <section aria-labelledby="why-heading" className="w-full max-w-3xl">
          <h2 id="why-heading" className="font-display text-lg font-semibold text-white">
            {messages.whyTitle}
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              [messages.why1Title, messages.why1Text],
              [messages.why2Title, messages.why2Text],
              [messages.why3Title, messages.why3Text],
              [messages.why4Title, messages.why4Text],
            ].map(([title, text]) => (
              <li key={title} className="border-l-2 border-brass-500/60 pl-3">
                <p className="text-sm font-semibold text-white/90">{title}</p>
                <p className="mt-0.5 text-sm text-white/65">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="demo-heading" className="w-full max-w-3xl border-t border-line pt-8">
          <h2 id="demo-heading" className="font-display text-base font-semibold text-white/70">
            {messages.pickTemplateTitle}
          </h2>
          <p className="mt-1 text-xs text-white/50">{messages.pickTemplateHint}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {TEMPLATE_MANIFEST.map((entry) => (
              <li key={entry.slug}>
                <button
                  type="button"
                  onClick={() => setSelected(entry)}
                  className="flex min-h-11 w-full items-center gap-3 rounded border border-line px-3 py-2 text-left text-sm text-white/80 transition-colors duration-150 ease-out-quart hover:border-line-strong hover:bg-white/5 hover:text-white active:scale-[0.99]"
                >
                  <span aria-hidden="true" className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-wider text-brass-400">
                    {entry.code}
                  </span>
                  <span>{entry.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
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

  // Only the bundled templates have example data; imported ones don't.
  const hasExampleData = Object.keys(dummyValuesFor(loaded.meta.id)).length > 0;
  const canDownloadFinal = !validation.hasBlockingError;
  const requiredFields = loaded.groups.flatMap((g) => g.fields).filter((f) => f.required && f.type !== undefined);
  const requiredFilled = requiredFields.filter((f) => (values[f.id] ?? '').trim() !== '').length;
  const errorFieldIds = new Set(validation.fieldIssues.filter((i) => i.severity === 'error').map((i) => i.field));

  const toggleFields = loaded.groups.flatMap((g) => g.fields).filter((f) => f.type === undefined);
  const fieldLookup = new Map(loaded.groups.flatMap((g) => g.fields).map((f) => [f.id, f] as const));
  // One entry per problem to fix, in form order: field issues first, then cross-field rules.
  const summaryEntries = [
    ...loaded.groups
      .flatMap((g) => g.fields)
      .filter((f) => errorFieldIds.has(f.id))
      .map((f) => ({
        key: f.id,
        fieldId: f.id,
        label: f.label,
        text: validation.fieldIssues
          .filter((i) => i.field === f.id && i.severity === 'error')
          .map((i) => fieldIssueMessage(i, f.type))
          .join(' '),
      })),
    ...validation.ruleIssues
      .filter((i) => i.severity === 'error')
      .map((i, n) => {
        const first = i.fields.map((id) => fieldLookup.get(id)).find((f) => f !== undefined);
        return { key: `rule-${n}`, fieldId: first?.id, label: first?.label ?? '', text: ruleIssueMessage(i) };
      }),
  ];

  return (
    <main className="flex min-h-screen flex-col bg-ink-950 lg:h-screen lg:overflow-hidden">
      <a
        href="#form-heading"
        className="sr-only z-50 rounded bg-brass-500 px-3 py-2 text-sm font-medium text-brass-ink focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        {messages.skipToForm}
      </a>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-400">{messages.appTitle}</p>
          <h1 className="font-display text-lg font-semibold text-white">{loaded.meta.title}</h1>
          <p className="text-xs text-white/60">
            {messages.templateVersion} {loaded.meta.version}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasExampleData && (
            <button type="button" onClick={handleFillDummy} className={buttonSecondary} title={messages.fillDummyHint}>
              {messages.fillDummy}
            </button>
          )}
          <button type="button" onClick={handleExportDraft} className={buttonSecondary} title={messages.draftSaveHint}>
            {messages.draftSave}
          </button>
          <button type="button" onClick={() => draftInputRef.current?.click()} className={buttonSecondary}>
            {messages.draftOpen}
          </button>
          <input
            ref={draftInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-label={messages.draftOpen}
            data-testid="draft-input"
            onChange={(e) => {
              void handleImportDraft(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button type="button" onClick={handleChangeTemplate} className={buttonSecondary}>
            {messages.changeTemplate}
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        {/* DOM order puts the preview first so it can be sticky-pinned to the
            top of the viewport below `lg` (where the form is a single very
            long scrolling column) — lg:order-2 restores it to the right-hand
            column once the two panes scroll independently side by side. */}
        <section
          className="sticky top-0 z-10 order-first flex flex-col border-b border-line bg-ink-900 lg:static lg:order-2 lg:w-1/2 lg:min-h-0 lg:border-b-0 lg:border-l"
          aria-labelledby="preview-heading"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line px-4 py-2.5 sm:px-6">
            <h2 id="preview-heading" className="whitespace-nowrap font-display text-sm font-semibold text-white/90">
              {messages.previewTitle}
            </h2>
            <p className="text-xs text-white/40 max-lg:hidden">{messages.previewApprox}</p>
            <button
              type="button"
              onClick={() => setPreviewCollapsed((c) => !c)}
              aria-expanded={!previewCollapsed}
              aria-controls="preview-body"
              className={`${buttonGhost} lg:hidden`}
            >
              {previewCollapsed ? messages.previewShow : messages.previewHide}
            </button>
          </div>
          <div
            id="preview-body"
            className={`h-[38vh] overflow-hidden bg-ink-900 p-3 sm:p-6 lg:h-[calc(100vh-8rem)] ${previewCollapsed ? 'max-lg:hidden' : ''}`}
          >
            <div className="h-full overflow-hidden rounded-sm shadow-[0_8px_30px_rgba(0,0,0,0.55)]">
              <Preview bytes={previewBytes} focusFieldId={activeFieldId ?? lastEditedFieldId} onFieldClick={handleFieldClick} />
            </div>
          </div>
        </section>

        <section className="order-last bg-ink-950 p-4 sm:p-6 lg:order-1 lg:w-1/2 lg:min-h-0 lg:overflow-auto" aria-labelledby="form-heading">
          <h2 id="form-heading" tabIndex={-1} className="sr-only">
            {messages.formTitle}
          </h2>
          {validation.structuralErrors.length > 0 && (
            <p role="alert" className="mb-4 rounded border border-rubric-500/40 bg-rubric-tint p-3 text-sm text-rubric-400">
              {messages.structuralErrorsTitle}
            </p>
          )}
          {attemptedDownload && summaryEntries.length > 0 && (
            <section
              ref={errorSummaryRef}
              tabIndex={-1}
              aria-labelledby="error-summary-title"
              className="mb-4 rounded-md border border-rubric-500/50 bg-rubric-tint p-4 outline-offset-2"
            >
              <h2 id="error-summary-title" className="font-display text-base font-semibold text-rubric-400">
                {messages.errorSummaryTitle}
              </h2>
              <p className="mt-1 text-xs text-white/70">{messages.errorSummaryHint}</p>
              <ul className="mt-2 space-y-1">
                {summaryEntries.map((e) => (
                  <li key={e.key}>
                    <button
                      type="button"
                      disabled={e.fieldId === undefined}
                      onClick={() => e.fieldId !== undefined && handleFieldClick(e.fieldId)}
                      className="text-left text-sm text-white/90 underline decoration-rubric-400/60 underline-offset-2 hover:decoration-rubric-400"
                    >
                      {e.label}
                      {e.label ? ' — ' : ''}
                      {e.text}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {requiredFields.length > 0 && (
            <div className="mb-4" role="group" aria-label={messages.progressLabel}>
              <div className="mb-1.5 flex items-baseline justify-between text-xs text-white/60">
                <span>{messages.progressLabel}</span>
                <span className="tabular-nums text-white/80">
                  {requiredFilled}/{requiredFields.length}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-brass-500 transition-[width] duration-300 ease-out-quart"
                  style={{ width: `${Math.round((requiredFilled / requiredFields.length) * 100)}%` }}
                />
              </div>
            </div>
          )}
          <Form
            groups={loaded.groups}
            values={values}
            fieldIssues={validation.fieldIssues}
            activeFieldId={activeFieldId}
            showErrors={attemptedDownload}
            touchedFields={touchedFields}
            ruleIssues={validation.ruleIssues}
            blockDependents={blockDependents}
            onChange={handleChange}
            onFocusField={handleFocusField}
          />
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line bg-ink-950 px-4 py-3 sm:px-6">
        {attemptedDownload && !canDownloadFinal && (
          <p role="alert" className="mr-auto text-xs text-rubric-400">
            {summaryEntries.length} {messages.fieldsToFix}
          </p>
        )}
        <p role="status" aria-live="polite" className="mr-auto text-xs text-brass-300 empty:hidden">
          {statusMessage}
        </p>
        <button type="button" onClick={() => void handleDownloadDraft()} className={buttonSecondary}>
          {messages.downloadDraft}
        </button>
        <button
          type="button"
          aria-disabled={!canDownloadFinal}
          title={canDownloadFinal ? undefined : messages.downloadDisabledReason}
          onClick={() => {
            if (!canDownloadFinal) {
              setAttemptedDownload(true);
              setBlockedCount((c) => c + 1);
              return;
            }
            setReviewOpen(true);
          }}
          className={`${buttonPrimary} ${canDownloadFinal ? '' : 'cursor-not-allowed opacity-50'}`}
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
            {toggleFields.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-white/60">{messages.reviewClauses}</h3>
                <ul className="mt-2 max-h-52 space-y-1 overflow-auto pr-1">
                  {toggleFields.map((f) => {
                    const on = Boolean(values[f.id]);
                    return (
                      <li key={f.id} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-white/85">{f.label}</span>
                        <span className="flex shrink-0 items-baseline gap-2">
                          <span className={on ? 'text-brass-300' : 'text-white/60'}>
                            {on ? messages.reviewIncluded : messages.reviewNotIncluded}
                          </span>
                          <button
                            type="button"
                            className="text-xs text-white/80 underline underline-offset-2 hover:text-white"
                            onClick={() => {
                              setReviewOpen(false);
                              handleFieldClick(f.id);
                            }}
                          >
                            {messages.reviewChange}
                            <span className="sr-only"> — {f.label}</span>
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
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
