import type { EdubridgeContract } from 'cooptypes';
import { calculateRefund, type RefundCalculation, type RefundChainState } from '../../domain/economy/refund.calculator';
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
  return calculateRefund({
    chain: chainState(chain, course, `0.0000 ${symbol}`.trim()),
    starts_at: course.starts_at ? new Date(course.starts_at) : null,
    now,
    underfilled,
  });
}

/** Что контракт ведёт по подписке; без учёта занятий — нули. */
function chainState(chain: ChainSubscription | null, course: EdubridgeCourseRecord, zero: string): RefundChainState {
  const plan = chain?.plan;
  if (!chain || !plan || Number(plan.version) !== 1) return { charged: zero, reserve: zero, reserve_paid: zero, lessons_paid: 0, lessons_done: 0 };
  const symbol = zero.split(' ')[1] ?? '';
  return {
    charged: chain.charged ?? zero,
    reserve: plan.reserve ?? zero,
    reserve_paid: `${((lessonUnitMinor(course) * Number(plan.lessons_paid)) / ASSET_SCALE).toFixed(4)} ${symbol}`.trim(),
    lessons_paid: Number(plan.lessons_paid),
    lessons_done: Number(plan.lessons_done),
  };
}

const ASSET_SCALE = 10_000;

/** Оплата одного занятия по плановой ставке — как в контракте (`edu_terms::lesson_unit`): ставка за минуты занятия, нацело. */
function lessonUnitMinor(course: Pick<EdubridgeCourseRecord, 'planned_hourly_rate' | 'lesson_minutes'>): number {
  const rate = Math.round((Number.parseFloat(String(course.planned_hourly_rate ?? '').split(' ')[0]) || 0) * ASSET_SCALE);
  return Math.floor((rate * Number(course.lesson_minutes)) / 60);
}
