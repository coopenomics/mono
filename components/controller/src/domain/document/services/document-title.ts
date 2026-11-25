import { Registry } from '@coopenomics/docs-templates';

/**
 * Название документа по типу (номеру шаблона) из реестра шаблонов фабрики —
 * текущая редакция названия, а не текст, вписанный в документ при генерации.
 * Переименование шаблона в фабрике сразу доходит до всех документов реестра.
 */
const TITLES: ReadonlyMap<number, string> = new Map(
  Object.values(Registry as Record<string, { registry_id?: number; title?: string }>)
    .filter((entry) => typeof entry?.registry_id === 'number' && !!entry.title)
    .map((entry) => [entry.registry_id as number, entry.title as string])
);

/** Название по номеру шаблона; незнакомый номер — запасное название из документа. */
export function documentTitle(registryId: number | null | undefined, fallback = ''): string {
  return (registryId != null && TITLES.get(registryId)) || fallback;
}
