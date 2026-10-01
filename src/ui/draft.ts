import { z } from 'zod';

// A draft is the form's values as a small JSON file the user keeps themselves —
// the app stores nothing. Files come from outside, so they are untrusted input:
// size-capped, schema-checked, and reduced to known field ids with string values.

const MAX_DRAFT_BYTES = 512 * 1024;
const MAX_VALUE_LENGTH = 5000;

const DraftSchema = z.object({
  app: z.literal('minutas-lab'),
  templateId: z.string().min(1).max(100),
  templateVersion: z.string().max(50).optional(),
  savedAt: z.string().max(40).optional(),
  values: z.record(z.string().max(100), z.string().max(MAX_VALUE_LENGTH)),
});

export type DraftError = 'too-large' | 'not-json' | 'bad-shape' | 'other-template';

export type DraftResult =
  | { ok: true; values: Record<string, string>; ignored: number }
  | { ok: false; error: DraftError };

export function serializeDraft(templateId: string, templateVersion: string, values: Readonly<Record<string, string>>): string {
  const nonEmpty = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ''));
  return JSON.stringify(
    { app: 'minutas-lab', templateId, templateVersion, savedAt: new Date().toISOString(), values: nonEmpty },
    null,
    2,
  );
}

export function parseDraft(text: string, templateId: string, knownFieldIds: ReadonlySet<string>): DraftResult {
  if (text.length > MAX_DRAFT_BYTES) return { ok: false, error: 'too-large' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not-json' };
  }
  const parsed = DraftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'bad-shape' };
  if (parsed.data.templateId !== templateId) return { ok: false, error: 'other-template' };

  const values: Record<string, string> = {};
  let ignored = 0;
  for (const [id, value] of Object.entries(parsed.data.values)) {
    if (knownFieldIds.has(id)) values[id] = value;
    else ignored += 1;
  }
  return { ok: true, values, ignored };
}

export function saveJson(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
