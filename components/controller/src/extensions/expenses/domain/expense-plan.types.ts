import { registerEnumType } from '@nestjs/graphql';

/**
 * Периодичность планового расхода (requirement b6 «Экономика КУ», раунд 6).
 *
 * Разовый расход — `NONE`. Регулярный (аренда, электроэнергия) заводится один
 * раз с периодом: как только его срок наступает, система сама добавляет в
 * реестр следующий экземпляр той же серии. Неоплаченные экземпляры при этом
 * никуда не деваются и копятся — долг за прошлый месяц остаётся, даже когда
 * подошёл срок за текущий.
 *
 * Приоритетов у планового расхода нет: всё, что попало в реестр, подлежит
 * оплате — «срочное» и «необязательное» лишь путали резерв.
 */
export enum ExpensePlanRecurrence {
  /** Разовый расход — повторов нет. */
  NONE = 'NONE',
  /** Каждый месяц. */
  MONTHLY = 'MONTHLY',
  /** Раз в квартал. */
  QUARTERLY = 'QUARTERLY',
  /** Раз в год. */
  YEARLY = 'YEARLY',
}

registerEnumType(ExpensePlanRecurrence, {
  name: 'ExpensePlanRecurrence',
  description:
    'Периодичность планового расхода: разовый либо повторяющийся ежемесячно, ежеквартально или ежегодно.',
  valuesMap: {
    NONE: { description: 'Разовый расход.' },
    MONTHLY: { description: 'Повторяется каждый месяц.' },
    QUARTERLY: { description: 'Повторяется раз в квартал.' },
    YEARLY: { description: 'Повторяется раз в год.' },
  },
});

/** Сдвиг в месяцах для каждой периодичности. */
const RECURRENCE_MONTHS: Record<ExpensePlanRecurrence, number> = {
  [ExpensePlanRecurrence.NONE]: 0,
  [ExpensePlanRecurrence.MONTHLY]: 1,
  [ExpensePlanRecurrence.QUARTERLY]: 3,
  [ExpensePlanRecurrence.YEARLY]: 12,
};

/**
 * Дата следующего экземпляра серии; `null` для разового расхода.
 *
 * День месяца сохраняется: расход «первого числа» остаётся первым числом.
 * Если в целевом месяце такого дня нет (31-е в феврале) — берётся последний
 * день месяца, а не перескок на начало следующего.
 */
export function nextRecurrenceDate(
  from: Date,
  recurrence: ExpensePlanRecurrence
): Date | null {
  const months = RECURRENCE_MONTHS[recurrence];
  if (!months) return null;

  const day = from.getDate();
  const target = new Date(from.getTime());
  target.setDate(1);
  target.setMonth(target.getMonth() + months);
  const lastDayOfTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDayOfTargetMonth));
  return target;
}
