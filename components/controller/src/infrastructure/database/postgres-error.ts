/**
 * Код ошибки Postgres (SQLSTATE). TypeORM кладёт ошибку драйвера в
 * `driverError`, драйвер pg (и построитель запросов поверх него) отдаёт её
 * напрямую — поэтому смотрим оба места.
 */
export function postgresErrorCode(error: unknown): string | undefined {
  const e = error as { code?: unknown; driverError?: { code?: unknown } } | null;
  const code = e?.driverError?.code ?? e?.code;
  return typeof code === 'string' ? code : undefined;
}

/** Нарушение уникальности. */
export const PG_UNIQUE_VIOLATION = '23505';

/** Значение не разбирается как тип колонки: не-UUID в uuid, текст в integer. */
export const PG_INVALID_TEXT_REPRESENTATION = '22P02';
