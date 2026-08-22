import { Field, ObjectType, Int, Float } from '@nestjs/graphql';
import { ProviderSubscriptionStatus } from '~/domain/billing/enums/billing-statuses.enum';

/**
 * Позиция разбивки «суммы к оплате» по подписке (из provider getBillingSummary).
 */
@ObjectType('BillingSummaryItem')
export class BillingSummaryItemDTO {
  @Field(() => Int)
  subscriptionId!: number;

  @Field(() => Int)
  subscriptionTypeId!: number;

  @Field(() => String)
  subscriptionTypeName!: string;

  @Field(() => ProviderSubscriptionStatus)
  status!: ProviderSubscriptionStatus;

  @Field(() => Float)
  amount!: number;

  @Field(() => Boolean)
  isFree!: boolean;
}

/**
 * Сумма к оплате кооператива за период (проекция provider getBillingSummary в
 * GraphQL для реестра кооперативов Восхода, Epic 12 / Story 12.5).
 */
@ObjectType('BillingSummary')
export class BillingSummaryDTO {
  @Field(() => String)
  coopname!: string;

  @Field(() => Int)
  periodDays!: number;

  @Field(() => Float)
  totalAmount!: number;

  @Field(() => String)
  currency!: string;

  @Field(() => [BillingSummaryItemDTO])
  items!: BillingSummaryItemDTO[];

  @Field(() => String)
  paymentHash!: string;

  @Field(() => String, { nullable: true })
  nextPaymentDue?: string | null;
}
