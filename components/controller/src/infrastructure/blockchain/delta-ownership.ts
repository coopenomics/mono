import { DraftContract, RegistratorContract } from 'cooptypes';

/**
 * Кому принадлежит строка он-чейн таблицы.
 *
 * Узел синхронизирует только своё: чужие кооперативы живут в той же цепи, и без
 * отбора их состояние осело бы в базе как собственное. Обычная таблица
 * привязана к кооперативу либо именем в `scope`, либо полем `coopname` в самой
 * строке — это правило по умолчанию.
 *
 * Из него есть два вида исключений, и оба перечислены здесь поимённо, потому что
 * снятие проверки на принадлежность — это именно исключение, а не общее правило.
 */

/**
 * Таблицы, общие для всей сети: принадлежат платформе, а не кооперативу.
 *
 * Реестр шаблонов документов и переводы лежат в скоупе самого контракта `draft`.
 * Проверка на имя кооператива отбрасывала бы их всегда, и узел никогда бы о них
 * не узнал — а без шаблона не собрать ни один документ.
 */
const PLATFORM_WIDE_TABLES: ReadonlyArray<{ code: string; table: string }> = [
  { code: DraftContract.contractName.production, table: DraftContract.Tables.Drafts.tableName },
  { code: DraftContract.contractName.production, table: DraftContract.Tables.Translations.tableName },
];

/**
 * Таблицы, где принадлежность записана не в `coopname`, а в другом поле.
 *
 * Реестр кооперативов сети (`registrator::coops`) лежит в скоупе контракта и
 * называет кооператив полем `username` — оно и есть имя владельца строки. По
 * общему правилу такая дельта не прошла бы никогда, и узел остался бы без
 * собственных реквизитов: без них сборка документов падает на самом первом шаге,
 * потому что реквизиты кооператива входят в каждый документ.
 */
const OWNER_FIELD_OVERRIDES: ReadonlyArray<{ code: string; table: string; field: string }> = [
  {
    code: RegistratorContract.contractName.production,
    table: RegistratorContract.Tables.Cooperatives.tableName,
    field: 'username',
  },
];

/** Принадлежит ли таблица платформе целиком (а не конкретному кооперативу). */
export function isPlatformWideTable(code: string, table: string): boolean {
  return PLATFORM_WIDE_TABLES.some((t) => t.code === code && t.table === table);
}

/**
 * Относится ли дельта к нашему кооперативу — единственная точка, где решается
 * судьба входящей строки.
 */
export function isDeltaOwnedByCoop(
  delta: { code: string; table: string; scope: string; value?: unknown },
  coopname: string
): boolean {
  if (isPlatformWideTable(delta.code, delta.table)) return true;

  const override = OWNER_FIELD_OVERRIDES.find((t) => t.code === delta.code && t.table === delta.table);
  if (override) {
    return readNonEmptyString(delta.value, override.field) === coopname;
  }

  // Строгая проверка непустой строки: при битом ABI `value.coopname` приходит
  // пустой строкой, и без этой проверки она прошла бы сравнение мимо скоупа.
  const valueCoop = readNonEmptyString(delta.value, 'coopname');
  return (valueCoop ?? delta.scope) === coopname;
}

function readNonEmptyString(value: unknown, field: string): string | undefined {
  const raw = (value as Record<string, unknown> | undefined)?.[field];
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}
