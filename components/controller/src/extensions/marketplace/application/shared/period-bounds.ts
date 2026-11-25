import { standMonthSeconds, standPeriodKey } from '@coopenomics/extension-kit';

/**
 * Границы расчётного месяца по его номеру (задача 99D-22).
 *
 * Номер месяца — `standPeriodKey`: в работе год × 12 + месяц по UTC
 * (`PERIOD_TIME_ZONE`), на стенде со сжатым временем — номер отрезка длиной в месяц
 * стенда от начала эпохи. Границы нужны, чтобы собрать расходы участка за
 * закончившийся месяц: плановые расходы по сроку, служебные записки и
 * материальную помощь по времени блока. Начало — включительно, конец — нет.
 */
/**
 * Часовой пояс расчётного месяца — UTC (решение владельца 11.11.2026).
 * Контракт ведёт периоды списания и права на материальную помощь по UTC
 * (`Branch::aid_period`), пояса кооператива он не знает. Узел считает месяц
 * так же: иначе на стыке месяцев трата попадала у узла в один месяц, а у
 * контракта — в другой, и факты месяца расходились со счётчиками цепи.
 */
export const PERIOD_TIME_ZONE = 'UTC';

export interface PeriodBounds {
  start: Date;
  end: Date;
}

/** Смещение часового пояса в миллисекундах на момент `at`: сколько прибавить к UTC, чтобы получить местное время. */
function timeZoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return local - Math.floor(at.getTime() / 1000) * 1000;
}

/** Полночь первого числа месяца `year`-`month` (1–12) в часовом поясе кооператива. */
function monthStart(year: number, month: number, timeZone: string): Date {
  const utcMidnight = Date.UTC(year, month - 1, 1);
  return new Date(utcMidnight - timeZoneOffsetMs(new Date(utcMidnight), timeZone));
}

export function periodBounds(periodKey: number, timeZone: string): PeriodBounds {
  const monthSeconds = standMonthSeconds();
  if (monthSeconds > 0) {
    return { start: new Date(periodKey * monthSeconds * 1000), end: new Date((periodKey + 1) * monthSeconds * 1000) };
  }
  const year = Math.floor((periodKey - 1) / 12);
  const month = ((periodKey - 1) % 12) + 1;
  const start = monthStart(year, month, timeZone);
  const end = month === 12 ? monthStart(year + 1, 1, timeZone) : monthStart(year, month + 1, timeZone);
  return { start, end };
}

/** Номер месяца, в который попадает момент — тот же ключ, что у строк учёта к списанию. */
export function periodKeyOf(date: Date, timeZone: string): number {
  return standPeriodKey(date, timeZone);
}
