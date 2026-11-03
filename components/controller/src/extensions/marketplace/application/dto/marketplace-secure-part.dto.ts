import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

/**
 * Обеспечительная часть паевого взноса по заказу (99D-18): сколько, в каком
 * состоянии и когда станет членским взносом. Показывается в карточке заказа
 * у пайщика, администратора и оператора участка.
 */
export enum MarketplaceSecurePartState {
  /** Внесена при заказе, имущество ещё не получено. */
  RESERVED = 'RESERVED',
  /** Имущество получено, обеспечительная часть ждёт списания. */
  DUE = 'DUE',
  /** Списание приостановлено: по заказу открыт гарантийный возврат. */
  SUSPENDED = 'SUSPENDED',
  /** Списана в членский взнос участка. */
  CHARGED = 'CHARGED',
  /** Возвращена на свободный паевой: заказ отменён или имущество возвращено. */
  RETURNED = 'RETURNED',
}
registerEnumType(MarketplaceSecurePartState, {
  name: 'MarketplaceSecurePartState',
  description: 'Состояние обеспечительной части паевого взноса по заказу.',
});

@ObjectType('MarketplaceSecurePart')
export class MarketplaceSecurePartDTO {
  @Field(() => MarketplaceSecurePartState, { description: 'Состояние.' })
  state!: MarketplaceSecurePartState;

  @Field(() => String, { description: 'Сумма обеспечительной части по заказу.' })
  amount!: string;

  @Field(() => String, { description: 'Сколько ждёт списания.' })
  due_amount!: string;

  @Field(() => String, { description: 'Сколько уже списано в членский взнос.' })
  charged_amount!: string;

  @Field(() => String, { description: 'Сколько возвращено пайщику на свободный паевой Стола заказов по итогу месяца участка.' })
  returned_amount!: string;

  @Field(() => Date, { nullable: true, description: 'Когда спишется: первое число месяца после гарантийного срока.' })
  charge_at!: Date | null;

  @Field(() => Date, { nullable: true, description: 'Когда списана или возвращена.' })
  settled_at!: Date | null;
}
