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
    <form className="space-y-6" aria-label={messages.formTitle} onSubmit={(e) => e.preventDefault()}>
      {groups.map((group) => (
        <fieldset key={group.id} className="space-y-3">
          <legend className="text-sm font-semibold text-slate-700">{group.label}</legend>
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
                <div key={field.id} className="flex items-center gap-2">
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => onChange(field.id, e.target.checked ? 'true' : '')}
                    onFocus={() => onFocusField(field.id)}
                    onBlur={() => onFocusField(undefined)}
                    className="h-4 w-4"
                  />
                  <label htmlFor={inputId} className="text-sm text-slate-800">
                    {field.label}
                  </label>
                </div>
              );
            }

            return (
              <div key={field.id} className={`rounded-md p-2 ${isActive ? 'bg-blue-50' : value ? 'bg-slate-50' : ''}`}>
                <label htmlFor={inputId} className="block text-sm font-medium text-slate-800">
                  {field.label}
                  {field.required && (
                    <span aria-hidden="true" className="text-red-600">
                      {' '}
                      *
                    </span>
                  )}
                </label>
                {field.help && <p className="text-xs text-slate-500">{field.help}</p>}
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
                  className={`mt-1 w-full rounded border px-2 py-1 text-sm ${hasError ? 'border-red-500' : 'border-slate-300'}`}
                />
                {issues.length > 0 && (
                  <p id={errorId} role="alert" className={`mt-1 text-xs ${hasError ? 'text-red-600' : 'text-amber-600'}`}>
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
