import { Field, InputType, Int } from '@nestjs/graphql';

@InputType('MarketplaceTriggerOpenSubscriptionInput')
export class MarketplaceTriggerOpenSubscriptionInputDTO {
  @Field(() => String, { description: 'UUID Offer\'а с cycle_type=open_subscription.' })
  public readonly offer_id!: string;
}

@InputType('MarketplaceListConsolidatedRequestsInput')
export class MarketplaceListConsolidatedRequestsInputDTO {
  @Field(() => String, { nullable: true, description: 'UUID Offer\'а для фильтра.' })
  public readonly offer_id?: string;

  @Field(() => String, { nullable: true, description: 'Один из supplier-статусов (см. MarketplaceConsolidatedRequest.status).' })
  public readonly status?: string;

  @Field(() => Int, { defaultValue: 1 })
  public readonly page!: number;

  @Field(() => Int, { defaultValue: 50 })
  public readonly limit!: number;

  @Field(() => String, { defaultValue: 'DESC' })
  public readonly sortOrder!: 'ASC' | 'DESC';
}
