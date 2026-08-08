import { ObjectType, Field, Int } from '@nestjs/graphql';

/**
 * DTO для статистики доступности
 */
@ObjectType('MarketplaceAvailabilityStats')
export class AvailabilityStatsDTO {
  @Field(() => Int, { description: 'Общее количество доступных элементов' })
  totalAvailable!: number;

  @Field(() => Int, { description: 'Количество доступных категорий (целых)' })
  categoriesCount!: number;

  @Field(() => Int, { description: 'Количество доступных типов товаров' })
  typesCount!: number;

  @Field({ description: 'Есть ли ограничения по категориям' })
  hasRestrictions!: boolean;
}
