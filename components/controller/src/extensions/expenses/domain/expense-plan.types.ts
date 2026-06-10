import { registerEnumType } from '@nestjs/graphql';

/**
 * Приоритет плановой записи расхода (requirement b6 «Экономика КУ», раунд 5).
 *
 * В 30-дневный резерв входят: SCHEDULED с датой в ближайшие 30 дней (включая
 * просроченные) и все URGENT. OPTIONAL в резерв не входит — оплачивается при
 * наличии свободных средств.
 */
export enum ExpensePlanPriority {
  /** Оплата к указанной дате. */
  SCHEDULED = 'SCHEDULED',
  /** Срочный — оплатить как только возможно; всегда в резерве. */
  URGENT = 'URGENT',
  /** Необязательный — оплатить при наличии средств; в резерв не входит. */
  OPTIONAL = 'OPTIONAL',
}

registerEnumType(ExpensePlanPriority, {
  name: 'ExpensePlanPriority',
  description:
    'Приоритет планового расхода: к дате / срочный (всегда в резерве) / необязательный (не в резерве).',
});
