import { ObjectType, Field, Int } from '@nestjs/graphql';

/**
 * DTO для подсчета заявок по категории
 */
@ObjectType('MarketplaceCategoryRequestCount')
export class CategoryRequestCountDTO {
  @Field(() => Int, { description: 'ID категории' })
  categoryId!: number;

  @Field({ description: 'Название категории' })
  categoryName!: string;

  @Field(() => Int, { description: 'Количество заявок' })
  count!: number;

  constructor(data: { categoryId: number; categoryName: string; count: number }) {
    this.categoryId = data.categoryId;
    this.categoryName = data.categoryName;
    this.count = data.count;
  }
}

/**
 * DTO для статистики заявок
 */
@ObjectType('MarketplaceRequestStatistics')
export class RequestStatisticsDTO {
  @Field(() => Int, { description: 'Общее количество заявок' })
  totalRequests!: number;

  @Field(() => Int, { description: 'Активные предложения' })
  activeOffers!: number;

  @Field(() => Int, { description: 'Активные заказы' })
  activeOrders!: number;

  @Field(() => Int, { description: 'Завершенные сделки' })
  completedDeals!: number;

  @Field(() => [CategoryRequestCountDTO], { description: 'Заявки по категориям' })
  requestsByCategory!: CategoryRequestCountDTO[];

  constructor(data: {
    totalRequests: number;
    activeOffers: number;
    activeOrders: number;
    completedDeals: number;
    requestsByCategory: Array<{
      categoryId: number;
      categoryName: string;
      count: number;
    }>;
  }) {
    this.totalRequests = data.totalRequests;
    this.activeOffers = data.activeOffers;
    this.activeOrders = data.activeOrders;
    this.completedDeals = data.completedDeals;
    this.requestsByCategory = data.requestsByCategory.map((item) => new CategoryRequestCountDTO(item));
  }
}
