import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const CATALOG_SORTS = ['created_at_desc', 'price_asc', 'price_desc'] as const;

@InputType('MarketplaceListCatalogInput')
export class MarketplaceListCatalogInputDTO {
  @Field(() => Int, { nullable: true, description: 'category_id 1..10; null = «Все»' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  public category_id?: number | null;

  @Field(() => Int, { nullable: true, defaultValue: 24 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  public limit?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  public offset?: number;

  @Field(() => String, { nullable: true, description: 'created_at_desc | price_asc | price_desc' })
  @IsOptional()
  @IsIn(CATALOG_SORTS as unknown as string[])
  public sort?: 'created_at_desc' | 'price_asc' | 'price_desc';
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
