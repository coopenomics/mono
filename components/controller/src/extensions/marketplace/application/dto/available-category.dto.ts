import { ObjectType, Field, Int } from '@nestjs/graphql';

/**
 * DTO для доступной категории/типа
 */
@ObjectType('MarketplaceAvailableCategory')
export class AvailableCategoryDTO {
  @Field(() => Int, { description: 'ID записи' })
  id!: number;

  @Field({ description: 'Название кооператива' })
  coopname!: string;

  @Field(() => Int, { description: 'ID категории' })
  categoryId!: number;

  @Field(() => Int, { description: 'ID типа товара (null = вся категория)', nullable: true })
  typeId?: number;

  @Field({ description: 'Активна ли категория/тип' })
  isActive!: boolean;

  @Field({ description: 'Кто добавил категорию/тип' })
  addedBy!: string;

  @Field({ description: 'Применяется к всей категории' })
  isForEntireCategory!: boolean;

  @Field({ description: 'Применяется к конкретному типу' })
  isForSpecificType!: boolean;

  @Field({ description: 'Дата создания' })
  createdAt!: Date;

  @Field({ description: 'Дата обновления' })
  updatedAt!: Date;
}
