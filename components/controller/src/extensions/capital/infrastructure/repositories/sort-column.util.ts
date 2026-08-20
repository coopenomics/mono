import type { Repository, ObjectLiteral } from 'typeorm';

/**
 * Имя поля сортировки приходит от клиента и подставляется в `ORDER BY` строкой,
 * поэтому произвольную строку туда пускать нельзя. Разрешённый набор берём из
 * метаданных сущности: колонка, которой нет в таблице, молча заменяется на
 * умолчание — список не должен падать из-за устаревшей ссылки в клиенте.
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
