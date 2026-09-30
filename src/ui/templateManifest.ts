import cpcvUrl from '../../templates/cpcv/template.docx?url';
import cpcvMeta from '../../templates/cpcv/template.meta.json';
import arrendamentoUrl from '../../templates/arrendamento/template.docx?url';
import arrendamentoMeta from '../../templates/arrendamento/template.meta.json';
import empreitadaUrl from '../../templates/empreitada/template.docx?url';
import empreitadaMeta from '../../templates/empreitada/template.meta.json';
import procuracaoUrl from '../../templates/procuracao/template.docx?url';
import procuracaoMeta from '../../templates/procuracao/template.meta.json';

export interface TemplateManifestEntry {
  slug: string;
  title: string;
  /** Short filing reference shown on the template picker card (e.g. a cartório dossier tab). */
  code: string;
  docxUrl: string;
  metaRaw: unknown;
}

export const TEMPLATE_MANIFEST: TemplateManifestEntry[] = [
  { slug: 'cpcv', title: cpcvMeta.title, code: 'CPCV', docxUrl: cpcvUrl, metaRaw: cpcvMeta },
  { slug: 'arrendamento', title: arrendamentoMeta.title, code: 'ARR', docxUrl: arrendamentoUrl, metaRaw: arrendamentoMeta },
  { slug: 'empreitada', title: empreitadaMeta.title, code: 'EMP', docxUrl: empreitadaUrl, metaRaw: empreitadaMeta },
  { slug: 'procuracao', title: procuracaoMeta.title, code: 'PROC', docxUrl: procuracaoUrl, metaRaw: procuracaoMeta },
];
