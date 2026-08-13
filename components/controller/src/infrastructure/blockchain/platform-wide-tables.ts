import { DraftContract } from 'cooptypes';

/**
 * Таблицы цепи, которые принадлежат платформе, а не отдельному кооперативу.
 *
 * Обычная он-чейн таблица привязана к кооперативу — именем в `scope` либо полем
 * `coopname` в самой строке, — и узел синхронизирует только своё. Реестр шаблонов
 * документов и их переводы устроены иначе: они общие для всей сети и лежат в
 * скоупе самого контракта `draft`. Проверка на имя кооператива отбрасывала бы их
 * всегда, и узел никогда бы о них не узнал — а без шаблона не собрать ни один
 * документ.
 *
 * Список намеренно закрытый и короткий: снятие проверки на принадлежность —
 * исключение, а не общее правило. Новая запись здесь означает «эта таблица
 * действительно общая для всех кооперативов сети».
 */
const PLATFORM_WIDE_TABLES: ReadonlyArray<{ code: string; table: string }> = [
  { code: DraftContract.contractName.production, table: DraftContract.Tables.Drafts.tableName },
  { code: DraftContract.contractName.production, table: DraftContract.Tables.Translations.tableName },
];

/** Принадлежит ли таблица платформе целиком (а не конкретному кооперативу). */
export function isPlatformWideTable(code: string, table: string): boolean {
  return PLATFORM_WIDE_TABLES.some((t) => t.code === code && t.table === table);
}
