import type { InnerExpensePlan } from '@coopenomics/innercoop';

/**
 * Цель плановых расходов участка (задача 99D-34, решение владельца 10.11.2026):
 * сумма записей реестра планов участка, которые ещё предстоит оплатить из
 * общего кошелька, со сроком раньше `until`, включая просроченные.
 *
 * Запись входит в цель, пока оплата не запущена: у записи нет служебной
 * записки (`proposalHash`) и отметки об оплате (`paidAt`). Запущенная оплата
 * выделяет деньги с общего кошелька операцией выделения — с этого момента они
 * считаются тратой месяца, а не целью; отказ совета снимает привязку, и запись
 * снова входит в цель. Записи без срока в цель не входят.
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
  assetToUnits: (asset: string) => bigint
): bigint {
  return plans
    .filter((p) => p.branchName === braname && !p.paidAt && !p.proposalHash && p.dueDate && p.dueDate < until)
    .reduce((sum, p) => sum + assetToUnits(p.amount), 0n);
}
