import { Field, InputType, registerEnumType } from '@nestjs/graphql';
import { MarketplaceConsolidatedRequestStatuses } from '../../domain/entities/marketplace-consolidated-request.types';

export const MarketplaceConsolidatedRequestStatusEnum = MarketplaceConsolidatedRequestStatuses;
export type MarketplaceConsolidatedRequestStatusEnum =
  (typeof MarketplaceConsolidatedRequestStatusEnum)[keyof typeof MarketplaceConsolidatedRequestStatusEnum];

registerEnumType(MarketplaceConsolidatedRequestStatusEnum, {
  name: 'MarketplaceConsolidatedRequestStatus',
  description: 'Состояние сводной заявки поставщика на поставку партии заказов.',
});

@InputType('MarketplaceListConsolidatedRequestsInput')
export class MarketplaceListConsolidatedRequestsInputDTO {
  @Field(() => String, { nullable: true, description: 'Фильтр по идентификатору предложения.' })
  public readonly offer_id?: string;

  @Field(() => MarketplaceConsolidatedRequestStatusEnum, {
    nullable: true,
    description: 'Фильтр по состоянию сводной заявки.',
  })
  public readonly status?: MarketplaceConsolidatedRequestStatusEnum;
}
