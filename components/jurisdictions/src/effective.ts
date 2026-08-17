import type { EffectiveRecord } from './types';

/**
 * Значение, действовавшее на указанную дату: последняя запись, чья дата
 * вступления в силу не позже искомой.
 *
 * Для даты раньше самой первой записи возвращается `null` — это честнее
 * подстановки ближайшего значения. Справочник заведён не с начала времён, и
 * выдавать сегодняшние реквизиты за прошлогодние он не должен.
 */
export function resolveEffective<T>(
  records: EffectiveRecord<T>[],
  on: Date | string
): T | null {
  const target = typeof on === 'string' ? on : toIsoDate(on);
  let found: EffectiveRecord<T> | null = null;
  for (const record of records) {
    if (record.effectiveFrom > target) continue;
    if (!found || record.effectiveFrom > found.effectiveFrom) found = record;
  }
  return found ? found.value : null;
}

/** Дата в виде ГГГГ-ММ-ДД — строки такого формата сравнимы лексикографически. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
