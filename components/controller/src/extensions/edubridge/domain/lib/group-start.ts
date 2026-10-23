import type { EdubridgeGroupRecord } from '../../infrastructure/entities';

/**
 * Момент начала занятий группы: названный с точностью до минуты (стенд со
 * сжатым временем) либо начало дня из даты начала.
 *
 * Момент отдаётся целыми секундами — так его хранит цепь. С долями секунды
 * конец программы на сервере выходил на долю секунды позже оплаченного срока
 * из цепи, и подписка, оплаченная до конца программы, считалась продлеваемой.
 */
export function startMomentOf(group: Pick<EdubridgeGroupRecord, 'starts_at' | 'starts_at_time'>): string | null {
  return group.starts_at_time ? wholeSeconds(new Date(group.starts_at_time)).toISOString() : group.starts_at;
}

/** Момент без долей секунды: точность времени цепи. */
export function wholeSeconds(moment: Date): Date {
  return new Date(Math.floor(moment.getTime() / 1000) * 1000);
}

/** День начала занятий наступил; группа без даты начала не начиналась. */
export function hasStarted(startsAt: string | null | undefined, now: Date = new Date()): boolean {
  return Boolean(startsAt) && new Date(startsAt as string).getTime() <= now.getTime();
}
