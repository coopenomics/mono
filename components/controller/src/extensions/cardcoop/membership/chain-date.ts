/**
 * Дата из времени цепи (story 7.2, FR-E2).
 *
 * `time_point_sec` приезжает строкой без указания зоны (`2026-08-31T10:00:00`), а это UTC.
 * Отдать её `new Date()` как есть — значит получить местное время сервера и ошибиться на
 * смещение зоны: около полуночи дата приёма в свидетельстве уехала бы на сутки.
 *
 * @packageDocumentation
 */

/**
 * Приводит момент времени цепи к дате `YYYY-MM-DD`.
 *
 * @param value — значение поля времени из ответа или действия цепи.
 * @returns Дата в UTC; `null`, если строка не разбирается как момент времени.
 */
export function chainDate(value: string): string | null {
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
  const moment = new Date(normalized);
  if (Number.isNaN(moment.getTime())) return null;
  return moment.toISOString().slice(0, 10);
}
