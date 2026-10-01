import type { FieldDescriptor, FieldGroup } from './fieldModel';
import type { FieldIssue, RuleIssue } from '../core/template/validate';
import { fieldIssueMessage, ruleIssueMessage } from './issueMessages';
import { formatDatePt, parseDatePt } from '../core/formats/date';
import { messages } from './messages.pt';

// A <select> only replaces free text when the set of valid answers is small
// and closed. Beyond that, a dropdown becomes a scroll-to-find chore — worse
// than just typing — so it falls back to a normal open field.
const MAX_SELECT_OPTIONS = 10;

function isSelectField(field: FieldDescriptor): field is FieldDescriptor & { options: string[] } {
  return field.options !== undefined && field.options.length > 0 && field.options.length <= MAX_SELECT_OPTIONS;
}

// Inputs sit a shade darker than the group card (bg-ink-900) so they read as
// a "well" set into the card rather than blending flat into it.
function inputClasses(hasError: boolean, extra = ''): string {
  return `min-h-11 w-full rounded border bg-ink-950 px-2.5 py-1.5 text-sm text-white transition-colors duration-150 ease-out-quart placeholder:text-white/30 sm:min-h-0 ${extra} ${
    hasError ? 'border-rubric-500/60' : 'border-line focus:border-brass-400'
  }`;
}

// NIF/NIPC are always 9 plain digits — a numeric keyboard on mobile with no
// letter keys. (CC numbers include a letter check-suffix, so they stay
// alphanumeric.)
const NUMERIC_ID_TYPES = new Set(['nif', 'nipc']);

function isEmailField(field: FieldDescriptor): boolean {
  return field.type === 'text' && (field.id === 'email' || field.id.endsWith('_email'));
}

interface FormProps {
  groups: FieldGroup[];
  values: Record<string, string>;
  fieldIssues: FieldIssue[];
  activeFieldId: string | undefined;
  /** After a blocked download attempt: show every issue (required-empty included). Before it: only format errors of fields the user has already left. */
  showErrors: boolean;
  touchedFields: ReadonlySet<string>;
  ruleIssues: RuleIssue[];
  /** For each checkbox field: labels of the fields the template requires once it is ticked. */
  blockDependents: ReadonlyMap<string, string[]>;
  onChange: (id: string, value: string) => void;
  onFocusField: (id: string | undefined) => void;
}

/** "3/11" required fields filled in this group (a check once complete); nothing if it has none. */
function GroupProgress({ group, values }: { group: FieldGroup; values: Record<string, string> }) {
  const required = group.fields.filter((f) => f.required && f.type !== undefined);
  if (required.length === 0) return null;
  const filled = required.filter((f) => (values[f.id] ?? '').trim() !== '').length;
  const done = filled === required.length;
  return (
    <span
      className={`font-sans text-xs font-medium tabular-nums ${done ? 'text-brass-300' : 'text-white/60'}`}
      title={messages.progressLabel}
    >
      {done ? '✓ ' : ''}
      {filled}/{required.length}
    </span>
  );
}

// Fixed-format types have a naturally bounded width (a NIF is always 9 digits, an
// IBAN always 25 chars) so two fit comfortably side by side.
const INLINABLE_TYPES = new Set(['nif', 'nipc', 'iban', 'cc', 'data', 'eur', 'int']);

// Free-text fields default to inline too — most (estado civil, freguesia, banco,
// e-mail...) are short. Only the handful that are genuinely long-form — full
// names, addresses, and the *_descricao/*_condicoes free-prose fields — stay
// full-width so they have room to breathe.
const LONG_TEXT_ID_PATTERNS = [/morada/, /_nome$/, /_descricao$/, /_condicoes$/];

function fieldSpan(field: FieldDescriptor): string {
  if (field.type === undefined) return 'sm:col-span-2'; // boolean block/condition toggle
  if (INLINABLE_TYPES.has(field.type)) return 'sm:col-span-1';
  const isLongText = LONG_TEXT_ID_PATTERNS.some((re) => re.test(field.id));
  return isLongText ? 'sm:col-span-2' : 'sm:col-span-1';
}

export function Form({ groups, values, fieldIssues, activeFieldId, showErrors, touchedFields, ruleIssues, blockDependents, onChange, onFocusField }: FormProps) {
  const issuesByField = new Map<string, FieldIssue[]>();
  for (const issue of fieldIssues) {
    const list = issuesByField.get(issue.field) ?? [];
    list.push(issue);
    issuesByField.set(issue.field, list);
  }

  // Cross-field rule problems (sum mismatch, date order...) are shown under each involved field, only after a download attempt.
  const ruleIssuesByField = new Map<string, RuleIssue[]>();
  if (showErrors) {
    for (const issue of ruleIssues) {
      for (const field of issue.fields) ruleIssuesByField.set(field, [...(ruleIssuesByField.get(field) ?? []), issue]);
    }
  }

  return (
    <form className="space-y-5" aria-label={messages.formTitle} onSubmit={(e) => e.preventDefault()}>
      {groups.map((group) => (
        <details
          key={group.id}
          className="group rounded-md border border-line bg-ink-900 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)] sm:p-5"
          open
        >
          <summary
            className="flex w-full cursor-pointer list-none items-center justify-between gap-2 border-b border-line pb-2 font-display text-lg font-semibold text-white/90 group-open:mb-3 [&::-webkit-details-marker]:hidden"
          >
            <span className="flex items-baseline gap-2">
              {group.label}
              <GroupProgress group={group} values={values} />
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 ease-out-quart group-open:rotate-180"
            >
              <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <fieldset className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2" aria-label={group.label}>
          {group.fields.map((field) => {
            const allIssues = issuesByField.get(field.id) ?? [];
            const issues = showErrors
              ? allIssues
              : touchedFields.has(field.id)
                ? allIssues.filter((i) => i.code === 'FORMAT_INVALID')
                : [];
            const ruleProblems = ruleIssuesByField.get(field.id) ?? [];
            const hasError = issues.some((i) => i.severity === 'error') || ruleProblems.some((i) => i.severity === 'error');
            const errorTexts = [
              ...issues.map((i) => fieldIssueMessage(i, field.type)),
              ...ruleProblems.map((i) => ruleIssueMessage(i)),
            ];
            const value = values[field.id] ?? '';
            const inputId = `field-${field.id}`;
            const errorId = `${inputId}-error`;
            const isActive = activeFieldId === field.id;

            if (field.type === undefined) {
              // Boolean block/condition toggle: adds or removes a clause of the contract.
              const on = Boolean(value);
              const needs = blockDependents.get(field.id);
              const statusId = `${inputId}-status`;
              return (
                <div key={field.id} className={`min-w-0 py-1 ${fieldSpan(field)}`}>
                  <div className="flex min-h-11 items-center gap-2.5 sm:min-h-0">
                    <input
                      id={inputId}
                      name={field.id}
                      type="checkbox"
                      checked={on}
                      aria-describedby={statusId}
                      onChange={(e) => onChange(field.id, e.target.checked ? 'true' : '')}
                      onFocus={() => onFocusField(field.id)}
                      onBlur={() => onFocusField(undefined)}
                      className="h-5 w-5 accent-brass-500 sm:h-4 sm:w-4"
                    />
                    <label htmlFor={inputId} className="text-sm text-white/80">
                      {field.label}
                    </label>
                  </div>
                  <p id={statusId} className={`mt-1 pl-[26px] text-xs ${on ? 'text-brass-300' : 'text-white/60'}`}>
                    {on ? messages.blockOn : messages.blockOff}
                    {on && needs && needs.length > 0 && ` · ${messages.blockNeeds} ${needs.join(', ')}`}
                  </p>
                </div>
              );
            }

            return (
              <div
                key={field.id}
                className={`min-w-0 rounded-md p-2.5 transition-colors duration-150 ease-out-quart ${fieldSpan(field)} ${
                  isActive ? 'bg-brass-500/10' : value ? 'bg-white/[0.03]' : ''
                }`}
              >
                <label htmlFor={inputId} className="block text-sm font-medium text-white/85">
                  {field.label}
                  {field.required && (
                    <span aria-hidden="true" className="text-white/35">
                      {' '}
                      *
                    </span>
                  )}
                </label>
                {field.help && <p className="mt-0.5 text-xs text-white/55">{field.help}</p>}
                {field.occurrences !== undefined && field.occurrences > 1 && (
                  <p className="mt-0.5 text-xs text-brass-300">
                    {messages.fieldUsedIn} {field.occurrences} {messages.fieldUsedPlaces}
                  </p>
                )}
                <div className="relative mt-1.5">
                  {isSelectField(field) ? (
                    <select
                      id={inputId}
                      name={field.id}
                      autoComplete="off"
                      value={value}
                      required={field.required}
                      aria-invalid={hasError}
                      aria-describedby={errorTexts.length > 0 ? errorId : undefined}
                      onChange={(e) => onChange(field.id, e.target.value)}
                      onFocus={() => onFocusField(field.id)}
                      onBlur={() => onFocusField(undefined)}
                      className={inputClasses(hasError)}
                    >
                      <option value="">{messages.selectPlaceholder}</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'data' ? (
                    <input
                      id={inputId}
                      name={field.id}
                      autoComplete="off"
                      type="date"
                      value={parseDatePt(value) ?? ''}
                      required={field.required}
                      aria-invalid={hasError}
                      aria-describedby={errorTexts.length > 0 ? errorId : undefined}
                      onChange={(e) => onChange(field.id, e.target.value ? (formatDatePt(e.target.value) ?? '') : '')}
                      onFocus={() => onFocusField(field.id)}
                      onBlur={() => onFocusField(undefined)}
                      className={inputClasses(hasError)}
                    />
                  ) : field.type === 'int' ? (
                    <input
                      id={inputId}
                      name={field.id}
                      autoComplete="off"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={value}
                      required={field.required}
                      aria-invalid={hasError}
                      aria-describedby={errorTexts.length > 0 ? errorId : undefined}
                      onChange={(e) => onChange(field.id, e.target.value)}
                      onFocus={() => onFocusField(field.id)}
                      onBlur={() => onFocusField(undefined)}
                      className={inputClasses(hasError)}
                    />
                  ) : field.type === 'eur' ? (
                    <input
                      id={inputId}
                      name={field.id}
                      autoComplete="off"
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={value}
                      required={field.required}
                      aria-invalid={hasError}
                      aria-describedby={errorTexts.length > 0 ? errorId : undefined}
                      onChange={(e) => onChange(field.id, e.target.value)}
                      onFocus={() => onFocusField(field.id)}
                      onBlur={() => onFocusField(undefined)}
                      className={inputClasses(hasError, 'pr-8')}
                    />
                  ) : (
                    <input
                      id={inputId}
                      name={field.id}
                      autoComplete="off"
                      type={isEmailField(field) ? 'email' : 'text'}
                      inputMode={NUMERIC_ID_TYPES.has(field.type) ? 'numeric' : undefined}
                      pattern={NUMERIC_ID_TYPES.has(field.type) ? '[0-9]*' : undefined}
                      value={value}
                      required={field.required}
                      aria-invalid={hasError}
                      aria-describedby={errorTexts.length > 0 ? errorId : undefined}
                      onChange={(e) => onChange(field.id, e.target.value)}
                      onFocus={() => onFocusField(field.id)}
                      onBlur={() => onFocusField(undefined)}
                      className={inputClasses(hasError)}
                    />
                  )}
                  {field.type === 'eur' && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-white/40"
                    >
                      €
                    </span>
                  )}
                </div>
                {errorTexts.length > 0 && (
                  <p id={errorId} role="alert" className={`mt-1.5 text-xs ${hasError ? 'text-rubric-400' : 'text-brass-300'}`}>
                    {errorTexts.join(' ')}
                  </p>
                )}
              </div>
            );
          })}
          </fieldset>
        </details>
      ))}
    </form>
  );
}
