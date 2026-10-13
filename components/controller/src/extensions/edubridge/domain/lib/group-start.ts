import type { EdubridgeGroupRecord } from '../../infrastructure/entities';

/**
 * Момент начала занятий группы: названный с точностью до минуты (стенд со
 * сжатым временем) либо начало дня из даты начала.
 */
export function startMomentOf(group: Pick<EdubridgeGroupRecord, 'starts_at' | 'starts_at_time'>): string | null {
  return group.starts_at_time ? new Date(group.starts_at_time).toISOString() : group.starts_at;
}

/** День начала занятий наступил; группа без даты начала не начиналась. */
export function hasStarted(startsAt: string | null | undefined, now: Date = new Date()): boolean {
  return Boolean(startsAt) && new Date(startsAt as string).getTime() <= now.getTime();
}
