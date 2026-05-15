import { Field, InputType, Int } from '@nestjs/graphql';

@InputType('MarketplaceCreateOrderInput')
export class MarketplaceCreateOrderInputDTO {
  @Field(() => String, { description: 'UUID Offer\'а из marketplace_offer.' })
  public readonly offer_id!: string;

  @Field(() => Int, { description: 'Количество единиц (>= 1; <= Offer.quantity_available для не-unlimited).' })
  public readonly quantity!: number;

  @Field(() => String, { description: 'branch.name выбранного ПВЗ получения (Story 2.3).' })
  public readonly delivery_braname!: string;
}

@InputType('MarketplaceCancelOrderInput')
export class MarketplaceCancelOrderInputDTO {
  @Field(() => String, { description: 'UUID Order\'а из marketplace_order. Заказчик-владелец отменяет до акцепта поставщиком.' })
  public readonly order_id!: string;
}

@InputType('MarketplaceAcceptConsolidatedRequestInput')
export class MarketplaceAcceptConsolidatedRequestInputDTO {
  @Field(() => String, { description: 'UUID консолидированной заявки (time_based / volume_based) в статусе PENDING_SUPPLIER_ACCEPT.' })
  public readonly request_id!: string;
}

@InputType('MarketplaceDeclineConsolidatedRequestInput')
export class MarketplaceDeclineConsolidatedRequestInputDTO {
  @Field(() => String, { description: 'UUID консолидированной заявки (time_based / volume_based) в статусе PENDING_SUPPLIER_ACCEPT.' })
  public readonly request_id!: string;
  @Field(() => String, { description: 'Обязательная причина отказа поставщика. Записывается в decline_reason заявки и last_status_reason каждого Order\'а пула.' })
  public readonly reason!: string;
}

@InputType('MarketplaceAcceptIndividualOrderInput')
export class MarketplaceAcceptIndividualOrderInputDTO {
  @Field(() => String, { description: 'UUID Order\'а cycle_type=individual в статусе ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL.' })
  public readonly order_id!: string;
}

@InputType('MarketplaceDeclineIndividualOrderInput')
export class MarketplaceDeclineIndividualOrderInputDTO {
  @Field(() => String, { description: 'UUID Order\'а cycle_type=individual в статусе ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL.' })
  public readonly order_id!: string;
  @Field(() => String, { description: 'Обязательная причина отказа поставщика.' })
  public readonly reason!: string;
}

@InputType('MarketplaceDeclineOrderFromOpenPoolInput')
export class MarketplaceDeclineOrderFromOpenPoolInputDTO {
  @Field(() => String, { description: 'UUID Order\'а cycle_type=open_subscription в статусе ACTIVE и cycle_id=null (пул ещё не запущен).' })
  public readonly order_id!: string;
  @Field(() => String, { description: 'Обязательная причина отказа поставщика.' })
  public readonly reason!: string;
}
