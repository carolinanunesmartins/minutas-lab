// M8: rewrite the blanks of a minuta into `{{id:type}}` tags and produce the
// matching template.meta.json, then lint the result with the same engine the
// templates/ lint uses, so an importer output is never worse than a hand-made one.
import { readDocx, toRawParagraphs } from '../docx/read';
import { rezip } from '../docx/build';
import { replaceTagsInParagraph } from '../docx/replace';
import type { TagReplacement } from '../docx/replace';
import { parseTemplate } from '../tags/parse';
import { isValidFieldId } from '../tags/types';
import { collectUsedFieldIds } from '../template/fields';
import { loadTemplateMeta } from '../template/meta';
import type { FieldMeta, GroupMeta, Meta } from '../template/meta';
import type { InferredBlank, InferredField } from './infer';

export interface GenerateInput {
  bytes: Uint8Array;
  blanks: readonly InferredBlank[];
  fields: readonly InferredField[];
  /** Field keys the user chose to leave as literal text. */
  excluded?: ReadonlySet<string>;
  title: string;
  templateId: string;
}

export interface GenerateProblem {
  code: string;
  message: string;
}

export interface GenerateResult {
  docxBytes: Uint8Array | null;
  meta: Meta | null;
  problems: GenerateProblem[];
}

function tagFor(field: InferredField, modifier: InferredBlank['modifier']): string {
  const mod = modifier === 'extenso' && (field.type === 'eur' || field.type === 'int') ? '|extenso' : '';
  const type = field.type === 'text' ? '' : `:${field.type}`;
  return `{{${field.id}${type}${mod}}}`;
}

export function generateTemplate(input: GenerateInput): GenerateResult {
  const { bytes, blanks, fields, excluded, title, templateId } = input;
  const problems: GenerateProblem[] = [];

  const byKey = new Map(fields.map((f) => [f.key, f] as const));
  const seen = new Set<string>();
  for (const f of fields) {
    if (excluded?.has(f.key)) continue;
    if (!isValidFieldId(f.id)) problems.push({ code: 'FIELD_ID_INVALID', message: `Identificador inválido: "${f.id}".` });
    if (seen.has(f.id)) problems.push({ code: 'FIELD_ID_DUPLICATE', message: `Identificador repetido: "${f.id}".` });
    seen.add(f.id);
  }
  if (problems.length > 0) return { docxBytes: null, meta: null, problems };

  const doc = readDocx(bytes);
  const perParagraph = new Map<number, TagReplacement[]>();
  const usedKeys = new Set<string>();
  for (const b of blanks) {
    const field = byKey.get(b.fieldKey);
    if (!field || excluded?.has(b.fieldKey)) continue;
    usedKeys.add(field.key);
    const list = perParagraph.get(b.blank.paraIndex) ?? [];
    list.push({ start: b.blank.start, end: b.blank.end, value: tagFor(field, b.modifier) });
    perParagraph.set(b.blank.paraIndex, list);
  }
  for (const [index, list] of perParagraph) {
    const paragraph = doc.paragraphs[index];
    if (!paragraph) continue;
    list.sort((a, b) => a.start - b.start);
    replaceTagsInParagraph(paragraph, list);
  }
  const docxBytes = rezip(doc.archive, doc.documentXmlDoc);

  const groupOrder: string[] = [];
  const metaFields: Record<string, FieldMeta> = {};
  for (const f of fields) {
    if (!usedKeys.has(f.key)) continue;
    if (!groupOrder.includes(f.group)) groupOrder.push(f.group);
    metaFields[f.id] = { label: f.label, group: f.group, required: true, ...(f.options && { options: f.options }) };
  }
  const groups: GroupMeta[] = groupOrder.map((g, order) => ({ id: g, label: g, order }));
  const metaRaw = { id: templateId, title, version: '0.1.0', groups, fields: metaFields };

  // Lint the output exactly like `npm run lint:templates` does.
  const parsed = parseTemplate(toRawParagraphs(readDocx(docxBytes)));
  for (const e of parsed.errors) problems.push({ code: e.code, message: e.message });
  const { meta, errors } = loadTemplateMeta(metaRaw, collectUsedFieldIds(parsed.paragraphs));
  for (const e of errors) problems.push({ code: e.code, message: e.message });

  const ok = problems.length === 0;
  return { docxBytes: ok ? docxBytes : null, meta: ok ? meta : null, problems };
}
