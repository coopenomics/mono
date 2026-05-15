import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationInputDTO } from '~/application/common/dto/pagination.dto';

@InputType('MarketplaceListCatalogInput')
export class MarketplaceListCatalogInputDTO extends PaginationInputDTO {
  @Field(() => Int, { nullable: true, description: 'category_id 1..9; null = «Все»' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  public category_id?: number | null;
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
