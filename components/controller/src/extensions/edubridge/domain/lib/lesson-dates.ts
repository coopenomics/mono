import { eduDaySeconds } from '../economy/time-scale';

/**
 * Даты занятия для акта хранения и для цепи. Акт читает человек, поэтому в нём
 * дата и время по-русски; контракт принимает `time_point_sec` секундной
 * точности без часового пояса.
 */
export function formatDateTime(value: Date): string {
  return `${formatDate(value)} ${value.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatDate(value: Date): string {
  return value.toLocaleDateString('ru-RU');
}

export function toChainTimePoint(value: Date): string {
  return new Date(Math.floor(value.getTime() / 1000) * 1000).toISOString().slice(0, 19);
}

/** Конец занятия: момент плюс длительность; на стенде со сжатым временем минуты занятия сжаты так же, как сутки. */
export function lessonEndsAt(lesson: { held_at: Date | string; duration_minutes: number }): Date {
  const scale = eduDaySeconds() / SECONDS_IN_REAL_DAY;
  return new Date(new Date(lesson.held_at).getTime() + lesson.duration_minutes * 60_000 * scale);
}

/** До какого момента принимается отчёт: конец занятия плюс срок на отчёт в сутках группы. */
export function reportUntil(lesson: { held_at: Date | string; duration_minutes: number }, reportDays: number): Date {
  return new Date(lessonEndsAt(lesson).getTime() + Math.max(0, reportDays) * eduDaySeconds() * 1000);
}

const SECONDS_IN_REAL_DAY = 24 * 60 * 60;
