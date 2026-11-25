import { registerEnumType } from '@nestjs/graphql';
import { expensePlanRecurrenceMonths, nextExpensePlanDate } from '@coopenomics/extension-kit';

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

/**
 * Дата следующего экземпляра серии; `null` для разового расхода.
 *
 * Календарь общий с Столом заказов (`nextExpensePlanDate` каркаса): число
 * месяца сохраняется, а если в целевом месяце такого числа нет (31-е в
 * феврале) — берётся последний день месяца. Счёт по UTC, как у месяцев
 * контракта: сроки на экране и в реестре совпадают при любом поясе сервера.
 */
export function nextRecurrenceDate(
  from: Date,
  recurrence: ExpensePlanRecurrence
): Date | null {
  return nextExpensePlanDate(from, expensePlanRecurrenceMonths(recurrence));
}
