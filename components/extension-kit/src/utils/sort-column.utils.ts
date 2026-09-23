import type { Repository, ObjectLiteral } from 'typeorm';

/**
 * Имя поля сортировки приходит от клиента и подставляется в `ORDER BY` строкой:
 * TypeORM вставляет его в SQL как есть, без параметров и экранирования. Поэтому
 * произвольную строку туда пускать нельзя. Разрешённый набор берём из
 * метаданных сущности: колонка, которой нет в таблице, молча заменяется на
 * умолчание — список не должен падать из-за устаревшей ссылки в клиенте.
 *
 * @param repository — репозиторий сущности, по чьим колонкам сортируем.
 * @param sortBy — имя поля от клиента.
 * @param fallback — колонка по умолчанию.
 * @returns Имя существующей колонки сущности.
 */
export function resolveSortColumn<T extends ObjectLiteral>(
  repository: Repository<T>,
  sortBy: string | undefined,
  fallback: string
): string {
  if (!sortBy) return fallback;

  const isKnownColumn = repository.metadata.columns.some(
    (column) => column.propertyName === sortBy || column.databaseName === sortBy
  );

  return isKnownColumn ? sortBy : fallback;
}
