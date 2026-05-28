import { Field, ObjectType } from '@nestjs/graphql';

/**
 * Результат мутаций `billingConvert` / `billingPay`.
 *
 * `transactionId` — id транзакции в чейне для трассировки.
 * `paymentHash` — для `billingPay` дублирует идентификатор платежа (для UI/сверки);
 * для `billingConvert` пуст.
 */
@ObjectType('BillingResult')
export class BillingResultDTO {
  @Field(() => String)
  transactionId!: string;

  @Field(() => String, { nullable: true })
  paymentHash?: string;
}
