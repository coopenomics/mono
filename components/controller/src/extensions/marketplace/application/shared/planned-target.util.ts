import type { InnerExpensePlan } from '@coopenomics/innercoop';
import { expensePlanReserveShare } from '@coopenomics/extension-kit';

/**
 * Цель плановых расходов участка (задача 99D-34, решения владельца 10.11.2026
 * и 11.11.2026): сколько резерв общего кошелька участка держит под записи
 * реестра планов к концу месяца `until`.
 *
 * Запись входит в цель, пока оплата не запущена: у записи нет служебной
 * записки (`proposalHash`) и отметки об оплате (`paidAt`). Запущенная оплата
 * выделяет деньги с общего кошелька операцией выделения — с этого момента они
 * считаются тратой месяца, а не целью; отказ совета снимает привязку, и запись
 * снова входит в цель. Записи без срока в цель не входят.
 *
 * Сколько от записи входит в цель:
 *  - срок раньше `until`, включая просроченные, — вся сумма;
 *  - срок позже — доля повторяющегося платежа: квартальный платёж копится три
 *    месяца, годовой — двенадцать, равными долями
 *    (`expensePlanReserveShare`); разовый и ежемесячный — ничего, их итог
 *    месяца собирает целиком за месяц до срока.
 * Месяцы считаются номерами месяца узла (`periodOf`): на стенде со сжатым
 * временем доля копится по месяцам стенда, как и всё остальное в итоге месяца.
 *
 * Одна функция на два места: факт `planned_target` итога месяца (`until` —
 * конец следующего месяца) и «Резерв» общего кошелька участка, который нельзя
 * распределить (`until` — конец текущего месяца, то есть цель, собранная
 * прошлым итогом).
 */
export function plannedTargetUnits(
  plans: readonly InnerExpensePlan[],
  braname: string,
  until: Date,
  assetToUnits: (asset: string) => bigint,
  periodOf: (date: Date) => number
): bigint {
  // Последний месяц, который покрывает цель: `until` — начало следующего месяца, не включительно.
  const coveredPeriod = periodOf(new Date(until.getTime() - 1));
  return plans
    .filter((p) => p.branchName === braname && !p.paidAt && !p.proposalHash && p.dueDate)
    .reduce((sum, p) => {
      const due = p.dueDate as Date;
      const amount = assetToUnits(p.amount);
      if (due < until) return sum + amount;
      return sum + expensePlanReserveShare(amount, periodOf(due) - coveredPeriod, p.recurrenceMonths ?? 0);
    }, 0n);
}
