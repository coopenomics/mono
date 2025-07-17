import { Resolver, Query, Mutation, Args, ObjectType, Field, Int } from '@nestjs/graphql';
import { Injectable, Inject } from '@nestjs/common';
import {
  AvailableCategoryDomainService,
  AVAILABLE_CATEGORY_DOMAIN_SERVICE,
} from '../../domain/services/available-category-domain.service';
import { CategoryTreeDomainService, CATEGORY_TREE_DOMAIN_SERVICE } from '../../domain/services/category-tree-domain.service';
import { CategoryDTO } from '../dto/category-tree.dto';
import config from '~/config/config';

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

/**
 * Input для добавления категорий
 */
import { InputType } from '@nestjs/graphql';

@InputType()
export class AddAvailableCategoriesInput {
  @Field(() => [Int], { description: 'ID категорий для добавления (целые категории)' })
  categoryIds!: number[];

  @Field({ description: 'Имя пользователя, добавляющего категории', nullable: true })
  addedBy?: string;
}

/**
 * Input для добавления типов товаров
 */
@InputType()
export class CategoryTypeInput {
  @Field(() => Int, { description: 'ID категории' })
  categoryId!: number;

  @Field(() => Int, { description: 'ID типа товара' })
  typeId!: number;
}

@InputType()
export class AddAvailableCategoryTypesInput {
  @Field(() => [CategoryTypeInput], { description: 'Типы товаров для добавления' })
  categoryTypes!: CategoryTypeInput[];

  @Field({ description: 'Имя пользователя, добавляющего типы', nullable: true })
  addedBy?: string;
}

/**
 * Input для удаления категорий
 */
@InputType()
export class RemoveAvailableCategoriesInput {
  @Field(() => [Int], { description: 'ID категорий для удаления' })
  categoryIds!: number[];
}

/**
 * Input для удаления типов товаров
 */
@InputType()
export class RemoveAvailableCategoryTypesInput {
  @Field(() => [CategoryTypeInput], { description: 'Типы товаров для удаления' })
  categoryTypes!: CategoryTypeInput[];
}

/**
 * Input для замены всех доступных элементов
 */
@InputType()
export class ReplaceAvailableItemsInput {
  @Field(() => [Int], { description: 'ID категорий (целые категории)', defaultValue: [] })
  categoryIds: number[] = [];

  @Field(() => [CategoryTypeInput], { description: 'Типы товаров', defaultValue: [] })
  categoryTypes: CategoryTypeInput[] = [];

  @Field({ description: 'Имя пользователя', nullable: true })
  addedBy?: string;
}

/**
 * GraphQL резолвер для администрирования доступных категорий и типов товаров marketplace
 */
@Resolver(() => AvailableCategoryDTO)
@Injectable()
export class AvailableCategoryAdminResolver {
  constructor(
    @Inject(AVAILABLE_CATEGORY_DOMAIN_SERVICE)
    private readonly availableCategoryService: AvailableCategoryDomainService,
    @Inject(CATEGORY_TREE_DOMAIN_SERVICE)
    private readonly categoryTreeService: CategoryTreeDomainService
  ) {}

  /**
   * Получить все доступные категории и типы для текущего кооператива
   */
  @Query(() => [AvailableCategoryDTO], {
    name: 'getAvailableCategories',
    description: 'Получить все доступные категории и типы для кооператива',
  })
  async getAvailableCategories(): Promise<AvailableCategoryDTO[]> {
    const availableCategories = await this.availableCategoryService.getAvailableCategories(config.coopname);

    return availableCategories.map((cat) => ({
      id: cat.id,
      coopname: cat.coopname,
      categoryId: cat.categoryId,
      typeId: cat.typeId,
      isActive: cat.isActive,
      addedBy: cat.addedBy,
      isForEntireCategory: cat.isForEntireCategory(),
      isForSpecificType: cat.isForSpecificType(),
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }));
  }

  /**
   * Получить дерево доступных категорий и типов
   */
  @Query(() => [CategoryDTO], {
    name: 'getAvailableCategoryTree',
    description: 'Получить дерево доступных категорий и типов для кооператива',
  })
  async getAvailableCategoryTree(): Promise<CategoryDTO[]> {
    const availableTree = await this.categoryTreeService.buildAvailableCategoryTree(config.coopname);
    return availableTree.map((category) => CategoryDTO.fromDomain(category));
  }

  /**
   * Получить статистику по доступности категорий
   */
  @Query(() => AvailabilityStatsDTO, {
    name: 'getAvailabilityStats',
    description: 'Получить статистику по доступности категорий в кооперативе',
  })
  async getAvailabilityStats(): Promise<AvailabilityStatsDTO> {
    const stats = await this.availableCategoryService.getAvailabilityStats(config.coopname);
    return {
      totalAvailable: stats.totalAvailable,
      categoriesCount: stats.categoriesCount,
      typesCount: stats.typesCount,
      hasRestrictions: stats.hasRestrictions,
    };
  }

  /**
   * Добавить категории в доступные (целые категории)
   */
  @Mutation(() => [AvailableCategoryDTO], {
    name: 'addAvailableCategories',
    description: 'Добавить категории в доступные для кооператива (целые категории)',
  })
  async addAvailableCategories(
    @Args('input', { type: () => AddAvailableCategoriesInput })
    input: AddAvailableCategoriesInput
  ): Promise<AvailableCategoryDTO[]> {
    const addedBy = input.addedBy || 'admin';
    const availableCategories = await this.availableCategoryService.addMultipleCategories(
      config.coopname,
      input.categoryIds,
      addedBy
    );

    return this.mapToDTO(availableCategories);
  }

  /**
   * Добавить типы товаров в доступные
   */
  @Mutation(() => [AvailableCategoryDTO], {
    name: 'addAvailableCategoryTypes',
    description: 'Добавить конкретные типы товаров в доступные для кооператива',
  })
  async addAvailableCategoryTypes(
    @Args('input', { type: () => AddAvailableCategoryTypesInput })
    input: AddAvailableCategoryTypesInput
  ): Promise<AvailableCategoryDTO[]> {
    const addedBy = input.addedBy || 'admin';
    const availableCategories = await this.availableCategoryService.addMultipleCategoryTypes(
      config.coopname,
      input.categoryTypes,
      addedBy
    );

    return this.mapToDTO(availableCategories);
  }

  /**
   * Удалить категории из доступных
   */
  @Mutation(() => Boolean, {
    name: 'removeAvailableCategories',
    description: 'Удалить категории из доступных для кооператива (включая все их типы)',
  })
  async removeAvailableCategories(
    @Args('input', { type: () => RemoveAvailableCategoriesInput })
    input: RemoveAvailableCategoriesInput
  ): Promise<boolean> {
    await this.availableCategoryService.removeMultipleCategories(config.coopname, input.categoryIds);
    return true;
  }

  /**
   * Удалить типы товаров из доступных
   */
  @Mutation(() => Boolean, {
    name: 'removeAvailableCategoryTypes',
    description: 'Удалить конкретные типы товаров из доступных для кооператива',
  })
  async removeAvailableCategoryTypes(
    @Args('input', { type: () => RemoveAvailableCategoryTypesInput })
    input: RemoveAvailableCategoryTypesInput
  ): Promise<boolean> {
    await this.availableCategoryService.removeMultipleCategoryTypes(config.coopname, input.categoryTypes);
    return true;
  }

  /**
   * Заменить все доступные категории и типы новым списком
   */
  @Mutation(() => [AvailableCategoryDTO], {
    name: 'replaceAvailableItems',
    description: 'Заменить все доступные категории и типы новым списком',
  })
  async replaceAvailableItems(
    @Args('input', { type: () => ReplaceAvailableItemsInput })
    input: ReplaceAvailableItemsInput
  ): Promise<AvailableCategoryDTO[]> {
    const addedBy = input.addedBy || 'admin';
    const availableCategories = await this.availableCategoryService.replaceAvailableItems(
      config.coopname,
      input.categoryIds,
      input.categoryTypes,
      addedBy
    );

    return this.mapToDTO(availableCategories);
  }

  /**
   * Очистить все доступные категории (сделать доступными все)
   */
  @Mutation(() => Boolean, {
    name: 'clearAvailableCategories',
    description: 'Очистить все доступные категории (сделать доступными все)',
  })
  async clearAvailableCategories(): Promise<boolean> {
    await this.availableCategoryService.replaceAvailableItems(config.coopname, [], [], 'admin');
    return true;
  }

  /**
   * Получить доступные правила для конкретной категории
   */
  @Query(() => [AvailableCategoryDTO], {
    name: 'getCategoryRules',
    description: 'Получить все доступные правила для конкретной категории',
  })
  async getCategoryRules(@Args('categoryId', { type: () => Int }) categoryId: number): Promise<AvailableCategoryDTO[]> {
    const rules = await this.availableCategoryService.getCategoryRules(config.coopname, categoryId);
    return this.mapToDTO(rules);
  }

  /**
   * Вспомогательный метод для маппинга в DTO
   */
  private mapToDTO(availableCategories: any[]): AvailableCategoryDTO[] {
    return availableCategories.map((cat) => ({
      id: cat.id,
      coopname: cat.coopname,
      categoryId: cat.categoryId,
      typeId: cat.typeId,
      isActive: cat.isActive,
      addedBy: cat.addedBy,
      isForEntireCategory: cat.isForEntireCategory(),
      isForSpecificType: cat.isForSpecificType(),
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }));
  }
}
