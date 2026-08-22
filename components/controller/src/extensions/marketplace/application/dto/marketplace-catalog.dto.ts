import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationInputDTO } from '@coopenomics/extension-kit';

@InputType('MarketplaceListCatalogInput')
export class MarketplaceListCatalogInputDTO extends PaginationInputDTO {
  @Field(() => Int, { nullable: true, description: 'Идентификатор категории; null = «Все»' })
  @IsOptional()
  @IsInt()
  @Min(1)
  public category_id?: number | null;

  @Field(() => String, {
    nullable: true,
    description:
      'Пункт выдачи (КУ) доставки. Если задан — в каталоге остаются только товары, ' +
      'которые возят на этот пункт выдачи (Эпик 16).',
  })
  @IsOptional()
  @IsString()
  public delivery_braname?: string | null;
}

@ObjectType('MarketplaceCategoryOfferCount')
export class MarketplaceCategoryOfferCountDTO {
  @Field(() => Int) public readonly category_id!: number;
  @Field(() => Int) public readonly count!: number;

  constructor(init: { category_id: number; count: number }) {
    this.category_id = init.category_id;
    this.count = init.count;
  }
}
