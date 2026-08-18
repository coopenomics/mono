/**
 * Время блока из SHiP-трейса — в момент записи в базу узла.
 *
 * Цепь живёт в UTC, но отдаёт время строкой без указания зоны:
 * «2026-08-13T00:00:01.500». `new Date()` такую строку трактует как локальное
 * время машины, поэтому на узле в любом поясе кроме UTC вся история молча
 * уехала бы на несколько часов — записи при этом выглядят правдоподобно, и
 * заметить подмену по данным нельзя. Зону проставляем явно.
 *
 * Отсутствие времени — обычное дело, а не сбой: старый парсер его не отдавал
 * вовсе, а у блока без тела (генезис) времени нет. Тогда возвращается `null`,
 * и колонка остаётся пустой — потребитель обязан это пережить.
 */
export function parseChainBlockTime(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const parsed = new Date(hasZone ? value : `${value}Z`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Хранение времени блока: в базе — `timestamptz`, в объекте — строка ISO.
 *
 * Строкой поле объявлено в контракте действия (`@coopenomics/innercoop`) и в
 * дельте каркаса — такими они приходят из потока событий, и менять публичную
 * форму ради устройства хранилища незачем. А в базе время обязано быть
 * временем: по строке не сделать выборку за период и не сравнить с `now()`.
 * Трансформер и есть та единственная точка, где одно переходит в другое.
 */
export const chainBlockTimeTransformer = {
  to(value?: string | Date | null): Date | null {
    return parseChainBlockTime(value);
  },
  from(value?: Date | null): string | undefined {
    return value ? value.toISOString() : undefined;
  },
};
