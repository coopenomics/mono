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
