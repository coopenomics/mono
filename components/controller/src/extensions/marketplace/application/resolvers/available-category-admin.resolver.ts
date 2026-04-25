import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { Injectable, Inject, UseGuards } from '@nestjs/common';
import {
  AvailableCategoryDomainService,
  AVAILABLE_CATEGORY_DOMAIN_SERVICE,
} from '../../domain/services/available-category-domain.service';
import { CategoryTreeDomainService, CATEGORY_TREE_DOMAIN_SERVICE } from '../../domain/services/category-tree-domain.service';
import { CategoryDTO } from '../dto/category-tree.dto';
import { AvailableCategoryDTO } from '../dto/available-category.dto';
import { AvailabilityStatsDTO } from '../dto/availability-stats.dto';
import { AddAvailableCategoriesInput } from '../dto/add-available-categories-input.dto';
import { AddAvailableCategoryTypesInput } from '../dto/add-available-category-types-input.dto';
import { RemoveAvailableCategoriesInput } from '../dto/remove-available-categories-input.dto';
import { RemoveAvailableCategoryTypesInput } from '../dto/remove-available-category-types-input.dto';
import { ReplaceAvailableItemsInput } from '../dto/replace-available-items-input.dto';
import { GqlJwtAuthGuard } from '~/modules/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/modules/auth/guards/roles.guard';
import { AuthRoles } from '~/modules/auth/decorators/auth.decorator';
import { CurrentUser } from '~/modules/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import config from '~/config/config';

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
    name: 'marketplaceGetAvailableCategories',
    description: 'Получить все доступные категории и типы для кооператива',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
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
    name: 'marketplaceGetAvailableCategoryTree',
    description: 'Получить дерево доступных категорий и типов для кооператива',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getAvailableCategoryTree(): Promise<CategoryDTO[]> {
    const availableTree = await this.categoryTreeService.buildAvailableCategoryTree(config.coopname);
    return availableTree.map((category) => CategoryDTO.fromDomain(category));
  }

  /**
   * Получить статистику по доступности категорий
   */
  @Query(() => AvailabilityStatsDTO, {
    name: 'marketplaceGetAvailabilityStats',
    description: 'Получить статистику по доступности категорий в кооперативе',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
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
    name: 'marketplaceAddAvailableCategories',
    description: 'Добавить категории в доступные для кооператива (целые категории)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async addAvailableCategories(
    @Args('input', { type: () => AddAvailableCategoriesInput })
    input: AddAvailableCategoriesInput,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<AvailableCategoryDTO[]> {
    const availableCategories = await this.availableCategoryService.addMultipleCategories(
      config.coopname,
      input.categoryIds,
      currentUser?.username ?? 'system'
    );

    return this.mapToDTO(availableCategories);
  }

  /**
   * Добавить типы товаров в доступные
   */
  @Mutation(() => [AvailableCategoryDTO], {
    name: 'marketplaceAddAvailableCategoryTypes',
    description: 'Добавить конкретные типы товаров в доступные для кооператива',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async addAvailableCategoryTypes(
    @Args('input', { type: () => AddAvailableCategoryTypesInput })
    input: AddAvailableCategoryTypesInput,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<AvailableCategoryDTO[]> {
    const availableCategories = await this.availableCategoryService.addMultipleCategoryTypes(
      config.coopname,
      input.categoryTypes,
      currentUser?.username ?? 'system'
    );

    return this.mapToDTO(availableCategories);
  }

  /**
   * Удалить категории из доступных
   */
  @Mutation(() => Boolean, {
    name: 'marketplaceRemoveAvailableCategories',
    description: 'Удалить категории из доступных для кооператива (включая все их типы)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
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
    name: 'marketplaceRemoveAvailableCategoryTypes',
    description: 'Удалить конкретные типы товаров из доступных для кооператива',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
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
    name: 'marketplaceReplaceAvailableItems',
    description: 'Заменить все доступные категории и типы новым списком',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async replaceAvailableItems(
    @Args('input', { type: () => ReplaceAvailableItemsInput })
    input: ReplaceAvailableItemsInput,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<AvailableCategoryDTO[]> {
    const availableCategories = await this.availableCategoryService.replaceAvailableItems(
      config.coopname,
      input.categoryIds,
      input.categoryTypes,
      currentUser?.username ?? 'system'
    );

    return this.mapToDTO(availableCategories);
  }

  /**
   * Очистить все доступные категории (сделать доступными все)
   */
  @Mutation(() => Boolean, {
    name: 'marketplaceClearAvailableCategories',
    description: 'Очистить все доступные категории (сделать доступными все)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async clearAvailableCategories(@CurrentUser() currentUser: MonoAccountDomainInterface): Promise<boolean> {
    await this.availableCategoryService.replaceAvailableItems(config.coopname, [], [], currentUser?.username ?? 'system');
    return true;
  }

  /**
   * Получить доступные правила для конкретной категории
   */
  @Query(() => [AvailableCategoryDTO], {
    name: 'marketplaceGetCategoryRules',
    description: 'Получить все доступные правила для конкретной категории',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
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
