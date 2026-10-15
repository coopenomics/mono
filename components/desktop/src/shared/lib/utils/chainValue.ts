/**
 * Значения из цепи приходят с неизвестным типом.
 *
 * Скаляры `ID` и `DateTime` в схеме объявлены без отображения на типы, поэтому
 * клиент отдаёт их как `unknown`: идентификатор нельзя подставить ключом списка,
 * дату — передать форматтеру. Приводим на месте, одинаково во всех реестрах,
 * вместо россыпи приведений в каждом экране.
 */

/** Идентификатор или иное текстовое значение из цепи. Пусто — пустая строка. */
export function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return '';
}

/**
 * Дата из цепи: приходит и строкой, и объектом. `String(date)` на объекте даёт
 * «Wed Jan 15 2025 …», который разбирается не везде, поэтому значение отдаётся
 * как есть, а неподходящее — заменяется пустотой.
 */
export function asDateInput(value: unknown): string | Date | undefined {
  return value instanceof Date || typeof value === 'string' ? value : undefined;
}
