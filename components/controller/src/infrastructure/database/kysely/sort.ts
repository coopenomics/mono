/**
 * Сортировка списка по полю, названному клиентом (C28-81).
 *
 * Имя колонки в запрос попадает только из перечня, заданного хранилищем: всё
 * остальное — опечатка, чужое поле или попытка подставить SQL — заменяется
 * сортировкой по умолчанию. Направление — только возрастание или убывание.
 */
export function sortColumn<const TColumn extends string>(
  allowed: readonly TColumn[],
  requested: string | undefined | null,
  fallback: TColumn
): TColumn {
  return allowed.includes(requested as TColumn) ? (requested as TColumn) : fallback;
}

export function sortDirection(requested: unknown, fallback: 'asc' | 'desc' = 'desc'): 'asc' | 'desc' {
  const value = typeof requested === 'string' ? requested.toUpperCase() : '';
  if (value === 'ASC') return 'asc';
  if (value === 'DESC') return 'desc';
  return fallback;
}
