import { humanizeFieldId } from '../core/template/fields';
import type { Meta } from '../core/template/meta';
import type { TagType } from '../core/tags/types';

export interface FieldDescriptor {
  id: string;
  label: string;
  help?: string;
  required: boolean;
  /** undefined = boolean block/condition toggle (no `{{id:type}}` tag exists for it). */
  type?: TagType;
  group?: string;
}

export interface FieldGroup {
  id: string;
  label: string;
  fields: FieldDescriptor[];
}

export function buildFieldGroups(
  usedIds: ReadonlySet<string>,
  fieldTypes: ReadonlyMap<string, TagType>,
  meta: Meta,
  ungroupedLabel: string,
): FieldGroup[] {
  const descriptors: FieldDescriptor[] = [...usedIds].map((id) => {
    const fieldMeta = meta.fields[id];
    const type = fieldTypes.get(id);
    return {
      id,
      label: fieldMeta?.label ?? humanizeFieldId(id),
      ...(fieldMeta?.help !== undefined && { help: fieldMeta.help }),
      required: fieldMeta?.required ?? false,
      ...(type !== undefined && { type }),
      ...(fieldMeta?.group !== undefined && { group: fieldMeta.group }),
    };
  });

  const groupOrder = [...(meta.groups ?? [])].sort((a, b) => a.order - b.order);
  const groups: FieldGroup[] = groupOrder.map((g) => ({ id: g.id, label: g.label, fields: [] }));
  const groupIndex = new Map(groups.map((g, i) => [g.id, i]));
  const ungrouped: FieldGroup = { id: '__ungrouped__', label: ungroupedLabel, fields: [] };

  for (const descriptor of descriptors) {
    const idx = descriptor.group !== undefined ? groupIndex.get(descriptor.group) : undefined;
    if (idx !== undefined) {
      groups[idx]?.fields.push(descriptor);
    } else {
      ungrouped.fields.push(descriptor);
    }
  }

  return ungrouped.fields.length > 0 ? [...groups, ungrouped] : groups;
}
