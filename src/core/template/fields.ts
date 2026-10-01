import type { ClassifiedParagraph, TagType } from '../tags/types';

/** id -> declared tag type, for every `{{id:type}}` value tag used in the body. */
export function collectFieldTypes(paragraphs: ClassifiedParagraph[]): Map<string, TagType> {
  const types = new Map<string, TagType>();
  for (const paragraph of paragraphs) {
    for (const node of paragraph.nodes) {
      if (node.kind === 'tag' && node.node.kind === 'value') {
        types.set(node.node.id, node.node.type);
      }
    }
  }
  return types;
}

/** id -> how many times its value tag appears in the body (one input, many places). */
export function collectFieldCounts(paragraphs: ClassifiedParagraph[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const paragraph of paragraphs) {
    for (const node of paragraph.nodes) {
      if (node.kind === 'tag' && node.node.kind === 'value') {
        counts.set(node.node.id, (counts.get(node.node.id) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/** Every id used anywhere as a form field: value tags, and block/condition ids. */
export function collectUsedFieldIds(paragraphs: ClassifiedParagraph[]): Set<string> {
  const ids = new Set<string>();
  for (const paragraph of paragraphs) {
    for (const node of paragraph.nodes) {
      if (node.kind !== 'tag') continue;
      const t = node.node;
      if (t.kind === 'value' || t.kind === 'blockOpen' || t.kind === 'condOpen') {
        ids.add(t.id);
      }
    }
  }
  return ids;
}

/** SPEC.md §5: "Fields absent from meta get humanised labels." e.g. "vendedor_nome" -> "Vendedor nome". */
export function humanizeFieldId(id: string): string {
  const spaced = id.replace(/_/g, ' ');
  return spaced.charAt(0).toLocaleUpperCase('pt-PT') + spaced.slice(1);
}
