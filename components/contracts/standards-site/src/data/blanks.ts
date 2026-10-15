/**
 * Бланки документов стандарта.
 *
 * Документ собирается тем же движком бланка, что и в фабрике документов
 * (`BlankTemplateEngine`): текст шаблона и переводы — из реестра cooptypes,
 * все поля без данных печатаются прочерком. Цепь и база не нужны. Шаблоны
 * здесь не меняются — сайт только показывает текущую редакцию из репозитория.
 */

import { Cooperative } from 'cooptypes';
import { BLANK_PLACEHOLDER, BlankTemplateEngine } from '@factory-templator';

/** Тип пайщика, под который собирается форма с ветвлением по типу. */
export type SubjectType = 'individual' | 'entrepreneur' | 'organization';

export const SUBJECT_TYPES: { value: SubjectType; label: string }[] = [
  { value: 'individual', label: 'Физлицо' },
  { value: 'entrepreneur', label: 'ИП' },
  { value: 'organization', label: 'Организация' },
];

interface RegistryTemplate {
  registry_id: number;
  title: string;
  context: string;
  translations: Record<string, Record<string, string>>;
}

let byId: Map<number, RegistryTemplate> | null = null;

function templates(): Map<number, RegistryTemplate> {
  if (byId) return byId;
  byId = new Map();
  for (const mod of Object.values(Cooperative.Registry as Record<string, unknown>)) {
    const t = mod as Partial<RegistryTemplate> | null;
    if (t && typeof t.registry_id === 'number' && typeof t.context === 'string' && t.translations) {
      byId.set(t.registry_id, t as RegistryTemplate);
    }
  }
  return byId;
}

export function hasBlank(registryId: number | undefined | null): boolean {
  return registryId != null && templates().has(registryId);
}

/** Форма ветвится по типу пайщика (физлицо / ИП / организация). */
export function branchesBySubject(registryId: number): boolean {
  const t = templates().get(registryId);
  // Сравнение именно с типом лица: в других шаблонах `type` — тип вопроса и т.п.
  return !!t && /\btype\s*==\s*['"](individual|entrepreneur|organization)['"]/.test(t.context);
}

/**
 * Оформление листа — как у фабрики при печати (шрифт, интервалы), плюс поля
 * для чтения на экране.
 */
const SHEET_STYLE = `
<meta charset="UTF-8">
<style>
  html { background: #f4f4f5; }
  body {
    max-width: 210mm;
    margin: 16px auto;
    padding: 20mm 18mm;
    background: #fff;
    color: #18181b;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    font-family: Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
  }
  p, li, td, th { line-height: 1.5; }
  h1 { line-height: 1.6; }
  h2, h3 { line-height: 1.5; }
</style>
`;

export interface Blank {
  title: string;
  html: string;
}

export function renderBlank(registryId: number, subject: SubjectType = 'individual'): Blank | null {
  const t = templates().get(registryId);
  if (!t) return null;
  const translation = t.translations.ru ?? Object.values(t.translations)[0] ?? {};
  const engine = new BlankTemplateEngine(translation as never);
  const vars: Record<string, unknown> = {
    meta: { created_at: BLANK_PLACEHOLDER },
    created_at: BLANK_PLACEHOLDER,
  };
  if (branchesBySubject(registryId)) vars.type = subject;
  const body = engine.renderBlank(t.context, vars, ['coop', 'vars', 'user']);
  return { title: t.title, html: `<!doctype html><html lang="ru"><head>${SHEET_STYLE}</head><body>${body}</body></html>` };
}
