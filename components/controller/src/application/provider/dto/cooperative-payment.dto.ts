import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { BillingPaymentLogStatus } from '~/infrastructure/billing/entities/billing-payment-log.entity';

registerEnumType(BillingPaymentLogStatus, {
  name: 'CooperativePaymentStatus',
  description:
    'Состояние списания: SUBMITTING — отправляется, SUBMITTED — принято нодой, CONFIRMED — провайдер подтвердил, FAILED — нода отклонила',
});

/**
 * Строка истории оплат кооператива в карточке совета.
 *
 * Источник — журнал биллинг-платежей хаба (`billing_payment_log`), а не цепь:
 * контракт биллинга on-chain таблиц не ведёт (RAM чейна на платежи не тратится,
 * решение @ant 2026-06-11), поэтому единственная летопись списаний — этот
 * журнал. Он же источник идемпотентности рекуррентных списаний, так что в нём
 * есть и незавершённые попытки — совет должен видеть и их, иначе «оплата не
 * прошла» выглядит как «оплаты не было».
 */
@ObjectType('CooperativePayment')
export class CooperativePaymentDTO {
  @Field(() => String, { description: 'Детерминированный идентификатор платежа из invoice провайдера' })
  payment_hash!: string;

  @Field(() => String, { description: 'Сумма списания с символом, например «1660.0000 RUB»' })
  quantity!: string;

  @Field(() => BillingPaymentLogStatus, { description: 'Состояние списания' })
  status!: BillingPaymentLogStatus;

  @Field(() => String, { nullable: true, description: 'Идентификатор принятой транзакции (с SUBMITTED)' })
  tx_id?: string;

  @Field(() => String, { nullable: true, description: 'Текст последней ошибки — для FAILED и зависших попыток' })
  last_error?: string;

  @Field(() => String, { description: 'Когда списание начато (ISO)' })
  created_at!: string;

  @Field(() => String, { description: 'Когда запись последний раз менялась (ISO)' })
  updated_at!: string;
}
