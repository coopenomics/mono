/**
 * Календарь повторяющегося планового расхода (задача 99D-34, решение
 * владельца 11.11.2026).
 *
 * Одна реализация на два расширения: расходы продолжают по ней серию записей
 * реестра, Стол заказов по ней же показывает председателю сроки будущих
 * платежей и считает резерв участка. Если правило поменяется только в одном
 * месте, экран пообещает один срок, а реестр заведёт другой.
 *
 * Календарь ведётся по UTC — как месяцы контракта и узла.
 */

/** Периодичность записи реестра плановых расходов — значения перечисления `ExpensePlanRecurrence`. */
export type ExpensePlanRecurrenceKey = 'NONE' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

/** Шаг серии в месяцах; 0 — разовый расход. */
export const EXPENSE_PLAN_RECURRENCE_MONTHS: Readonly<Record<ExpensePlanRecurrenceKey, number>> = {
  NONE: 0,
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

/** Шаг серии в месяцах по значению периодичности; неизвестное значение и пустота — разовый расход. */
export function expensePlanRecurrenceMonths(recurrence: string | null | undefined): number {
  if (!recurrence) return 0;
  return EXPENSE_PLAN_RECURRENCE_MONTHS[recurrence as ExpensePlanRecurrenceKey] ?? 0;
}

/**
 * Срок следующего платежа серии через `months` месяцев; `null` для разового расхода.
 *
 * Число месяца сохраняется: платёж «11-го» остаётся 11-м. Если в целевом месяце
 * такого числа нет (31-е в феврале), берётся последний день месяца, а не
 * перескок в следующий месяц. Время суток сохраняется.
 */
export function nextExpensePlanDate(from: Date, months: number): Date | null {
  if (!Number.isInteger(months) || months <= 0) return null;
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(from.getUTCDate(), lastDay);
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds()
    )
  );
}

/**
 * Сроки `count` платежей серии, начиная с `first` включительно.
 *
 * Каждый срок считается от предыдущего — так расширение расходов продолжает
 * серию: новая запись получает срок от срока прошлой записи. Серия «31-го»
 * после февраля остаётся на последнем дне февраля.
 */
export function expensePlanScheduleDates(first: Date, months: number, count: number): Date[] {
  if (count <= 0) return [];
  const dates = [first];
  let current: Date | null = first;
  while (dates.length < count && current) {
    current = nextExpensePlanDate(current, months);
    if (current) dates.push(current);
  }
  return dates;
}

/**
 * Доля суммы платежа, которую резерв держит к концу месяца.
 *
 * `monthsAhead` — сколько месяцев от последнего месяца, который покрывает
 * резерв, до месяца срока платежа. Ноль и меньше — срок внутри покрытия или
 * прошёл: резерв держит всю сумму. Повторяющийся платёж с шагом `periodMonths`
 * собирается равными долями за `periodMonths` месяцев: за `k` месяцев до срока
 * резерв держит `(periodMonths − k) / periodMonths` суммы, раньше — ничего.
 * Квартальный платёж копится три месяца, годовой — двенадцать, ежемесячный и
 * разовый — один месяц, целиком.
 *
 * Доля округляется вниз до единицы суммы; последний месяц перед сроком
 * добирает остаток, и к сроку в резерве лежит вся сумма.
 */
export function expensePlanReserveShare(amount: bigint, monthsAhead: number, periodMonths: number): bigint {
  if (amount <= 0n) return 0n;
  if (monthsAhead <= 0) return amount;
  if (!Number.isInteger(periodMonths) || periodMonths <= 1 || monthsAhead >= periodMonths) return 0n;
  return (amount * BigInt(periodMonths - monthsAhead)) / BigInt(periodMonths);
}

/** Сколько месяцев резерв копит один платёж: период повторяющегося расхода, для разового и ежемесячного — один. */
export function expensePlanReserveMonths(periodMonths: number): number {
  return Number.isInteger(periodMonths) && periodMonths > 1 ? periodMonths : 1;
}
