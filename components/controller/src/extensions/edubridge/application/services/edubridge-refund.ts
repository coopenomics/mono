import { EduEnrollmentPeriod } from '../../domain/enums';
import { addMonths } from '../../domain/economy/course-period.calculator';
import { calculateRefund, monthsOfPeriod, type RefundCalculation } from '../../domain/economy/refund.calculator';
import type { EdubridgeCourseEntity, EdubridgeEnrollmentEntity } from '../../infrastructure/entities';

/**
 * Сумма возврата по Положению ЦПП для подписки на текущий момент. Считают её и
 * отмена, и предпросмотр на столе, и удержание средств: удержано всегда не
 * меньше того, что участник может потребовать назад.
 */
export function refundOf(enrollment: EdubridgeEnrollmentEntity, course: EdubridgeCourseEntity, underfilled: boolean, now = new Date()): RefundCalculation {
  // У подписок, открытых до взноса за курс, число месяцев не сохранено — берём по периоду.
  const monthsPaid = enrollment.paid_months ?? monthsOfPeriod(enrollment.period === EduEnrollmentPeriod.YEAR ? 'year' : 'month');
  return calculateRefund({
    paid_amount: enrollment.paid_amount,
    lessons_per_month: course.lessons_per_month,
    lessons_total: course.lessons_total,
    months_paid: monthsPaid,
    paid_from: enrollment.paid_until ? addMonths(new Date(enrollment.paid_until), -monthsPaid) : null,
    starts_at: course.starts_at ? new Date(course.starts_at) : null,
    now,
    underfilled,
  });
}
