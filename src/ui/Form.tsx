import type { FieldGroup } from './fieldModel';
import type { FieldIssue } from '../core/template/validate';
import { messages } from './messages.pt';

interface FormProps {
  groups: FieldGroup[];
  values: Record<string, string>;
  fieldIssues: FieldIssue[];
  activeFieldId: string | undefined;
  onChange: (id: string, value: string) => void;
  onFocusField: (id: string | undefined) => void;
}

function issueMessage(issue: FieldIssue): string {
  if (issue.code === 'REQUIRED' || issue.code === 'REQUIRED_IF') return messages.fieldRequired;
  return issue.severity === 'warning' ? messages.fieldFormatInvalidWarning : messages.fieldFormatInvalid;
}

export function Form({ groups, values, fieldIssues, activeFieldId, onChange, onFocusField }: FormProps) {
  const issuesByField = new Map<string, FieldIssue[]>();
  for (const issue of fieldIssues) {
    const list = issuesByField.get(issue.field) ?? [];
    list.push(issue);
    issuesByField.set(issue.field, list);
  }

  return (
    <form className="space-y-7" aria-label={messages.formTitle} onSubmit={(e) => e.preventDefault()}>
      {groups.map((group) => (
        <fieldset key={group.id} className="space-y-3">
          <legend className="mb-3 w-full border-b border-line pb-1.5 font-display text-sm font-semibold text-white/80">
            {group.label}
          </legend>
          {group.fields.map((field) => {
            const issues = issuesByField.get(field.id) ?? [];
            const hasError = issues.some((i) => i.severity === 'error');
            const value = values[field.id] ?? '';
            const inputId = `field-${field.id}`;
            const errorId = `${inputId}-error`;
            const isActive = activeFieldId === field.id;

            if (field.type === undefined) {
              // Boolean block/condition toggle.
              return (
                <div key={field.id} className="flex items-center gap-2.5 py-1">
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => onChange(field.id, e.target.checked ? 'true' : '')}
                    onFocus={() => onFocusField(field.id)}
                    onBlur={() => onFocusField(undefined)}
                    className="h-4 w-4 accent-brass-500"
                  />
                  <label htmlFor={inputId} className="text-sm text-white/80">
                    {field.label}
                  </label>
                </div>
              );
            }

            return (
              <div
                key={field.id}
                className={`rounded-md p-2.5 transition-colors duration-150 ease-out-quart ${
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
                {field.help && <p className="mt-0.5 text-xs text-white/40">{field.help}</p>}
                <input
                  id={inputId}
                  type="text"
                  value={value}
                  required={field.required}
                  aria-invalid={hasError}
                  aria-describedby={issues.length > 0 ? errorId : undefined}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  onFocus={() => onFocusField(field.id)}
                  onBlur={() => onFocusField(undefined)}
                  className={`mt-1.5 w-full rounded border bg-ink-900 px-2.5 py-1.5 text-sm text-white transition-colors duration-150 ease-out-quart placeholder:text-white/30 ${
                    hasError ? 'border-rubric-500/60' : 'border-line focus:border-brass-400'
                  }`}
                />
                {issues.length > 0 && (
                  <p id={errorId} role="alert" className={`mt-1.5 text-xs ${hasError ? 'text-rubric-400' : 'text-brass-300'}`}>
                    {issues.map(issueMessage).join(' ')}
                  </p>
                )}
              </div>
            );
          })}
        </fieldset>
      ))}
    </form>
  );
}
