import type { EdubridgeContract } from 'cooptypes';
import { calculateRefund, type RefundCalculation } from '../../domain/economy/refund.calculator';
import type { EdubridgeCourseRecord, EdubridgeEnrollmentRecord } from '../../infrastructure/entities';

type ChainSubscription = EdubridgeContract.Tables.EduSubs.IEduSubscription;

/**
 * Предварительная сумма возврата по подписке на текущий момент — по строке
 * подписки из цепи. Показывается на столе до отмены и записывается после неё;
 * сам возврат считает и проводит контракт.
 *
 * Строки в цепи нет либо она открыта до учёта занятий — возвращать по ней
 * контракт не станет, показывается ноль.
 */
export function refundOf(
  enrollment: EdubridgeEnrollmentRecord,
  course: EdubridgeCourseRecord,
  chain: ChainSubscription | null,
  underfilled: boolean,
  now = new Date()
): RefundCalculation {
  const symbol = String(enrollment.paid_amount ?? '').trim().split(' ')[1] ?? '';
  const zero = `0.0000 ${symbol}`.trim();
  const tracked = chain?.plan && Number(chain.plan.version) === 1;
  return calculateRefund({
    chain: {
      charged: tracked ? chain?.charged ?? zero : zero,
      lessons_paid: tracked ? Number(chain?.plan?.lessons_paid ?? 0) : 0,
      lessons_done: tracked ? Number(chain?.plan?.lessons_done ?? 0) : 0,
    },
    starts_at: course.starts_at ? new Date(course.starts_at) : null,
    now,
    underfilled,
  });
}
