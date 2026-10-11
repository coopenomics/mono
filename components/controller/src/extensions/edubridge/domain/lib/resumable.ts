import { EduEnrollmentStatus } from '../enums';

/**
 * Оплаченный срок вышел, а подписка ещё в цепи — идёт срок на отчёт
 * преподавателя. По такой подписке рассчитываются занятия её оплаченного
 * срока, и опоздавший с взносом участник её продлевает.
 */
export function isResumable(enrollment: { status: EduEnrollmentStatus; chain_close_after?: Date | null }): boolean {
  return enrollment.status === EduEnrollmentStatus.EXPIRED && Boolean(enrollment.chain_close_after);
}
