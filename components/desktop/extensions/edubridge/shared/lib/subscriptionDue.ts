import type { IEnrollment } from '../../entities/Learner';

/** За сколько дней до конца оплаченного срока подписка считается требующей продления. */
export const RENEW_SOON_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Действующая подписка: оплачена либо ожидает подключения. */
export const isLiveEnrollment = (e: Pick<IEnrollment, 'status'>): boolean => e.status === 'ACTIVE' || e.status === 'PENDING';

/** Сколько полных дней оплачено вперёд; `null` — срок не задан. */
export function daysLeft(paidUntil: unknown, now = new Date()): number | null {
  if (!paidUntil) return null;
  const until = new Date(String(paidUntil)).getTime();
  if (Number.isNaN(until)) return null;
  return Math.max(0, Math.ceil((until - now.getTime()) / DAY_MS));
}

/** Подписку пора продлить: действует, а оплаченный срок кончается в ближайшие дни. */
export function isRenewSoon(e: Pick<IEnrollment, 'status' | 'paid_until'>, now = new Date()): boolean {
  if (!isLiveEnrollment(e)) return false;
  const left = daysLeft(e.paid_until, now);
  return left !== null && left <= RENEW_SOON_DAYS;
}
