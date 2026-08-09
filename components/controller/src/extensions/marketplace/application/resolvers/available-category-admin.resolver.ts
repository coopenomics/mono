import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { Injectable, Inject, UseGuards, BadRequestException } from '@nestjs/common';
import {
  AvailableCategoryDomainService,
  AVAILABLE_CATEGORY_DOMAIN_SERVICE,
} from '../../domain/services/available-category-domain.service';
import { CategoryTreeDomainService, CATEGORY_TREE_DOMAIN_SERVICE } from '../../domain/services/category-tree-domain.service';
import {
  MarketplaceCategoryService,
  MARKETPLACE_CATEGORY_SERVICE,
} from '../services/marketplace-category.service';
import { MarketplaceCategoryDTO } from '../dto/marketplace-offer.dto';
import { CreateCustomCategoryInput } from '../dto/create-custom-category-input.dto';
import { CategoryDTO } from '../dto/category-tree.dto';
import { AvailableCategoryDTO } from '../dto/available-category.dto';
import { AvailabilityStatsDTO } from '../dto/availability-stats.dto';
import { AddAvailableCategoriesInput } from '../dto/add-available-categories-input.dto';
import { AddAvailableCategoryTypesInput } from '../dto/add-available-category-types-input.dto';
import { RemoveAvailableCategoriesInput } from '../dto/remove-available-categories-input.dto';
import { RemoveAvailableCategoryTypesInput } from '../dto/remove-available-category-types-input.dto';
import { ReplaceAvailableItemsInput } from '../dto/replace-available-items-input.dto';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser, platformSettings } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';

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
    private readonly categoryTreeService: CategoryTreeDomainService,
    @Inject(MARKETPLACE_CATEGORY_SERVICE)
    private readonly categoryService: MarketplaceCategoryService
  ) {}

  /**
   * Полный редактируемый список категорий кооператива: общие baseline-категории
   * плюс собственные категории, добавленные кооперативом. Используется экраном
   * управления категориями (включение/выключение и добавление своих).
   */
  @Query(() => [MarketplaceCategoryDTO], {
    name: 'marketplaceListCoopCategories',
    description: 'Категории кооператива: общие и собственные',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async listCoopCategories(): Promise<MarketplaceCategoryDTO[]> {
    const cats = await this.categoryService.listForCoop(platformSettings().coopname);
    return cats.map(
      (c) =>
        new MarketplaceCategoryDTO({
          id: c.id,
          display_name: c.display_name,
          sort_order: c.sort_order,
          mvp_baseline: c.mvp_baseline,
        })
    );
  }

  /**
   * Добавить собственную категорию кооператива.
   */
  @Mutation(() => MarketplaceCategoryDTO, {
    name: 'marketplaceCreateCustomCategory',
    description: 'Добавить собственную категорию кооператива',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async createCustomCategory(
    @Args('input', { type: () => CreateCustomCategoryInput })
    input: CreateCustomCategoryInput
  ): Promise<MarketplaceCategoryDTO> {
    try {
      const c = await this.categoryService.createCustom(platformSettings().coopname, input.displayName);
      return new MarketplaceCategoryDTO({
        id: c.id,
        display_name: c.display_name,
        sort_order: c.sort_order,
        mvp_baseline: c.mvp_baseline,
      });
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  /**
   * Удалить собственную категорию кооператива. Заодно убирает её из списка
   * доступных (whitelist), чтобы не осталась «висящая» ссылка на удалённую категорию.
   */
  @Mutation(() => Boolean, {
    name: 'marketplaceDeleteCustomCategory',
    description: 'Удалить собственную категорию кооператива',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async deleteCustomCategory(
    @Args('categoryId', { type: () => Int }) categoryId: number
  ): Promise<boolean> {
    const deleted = await this.categoryService.deleteCustom(platformSettings().coopname, categoryId);
    if (!deleted) {
      throw new BadRequestException('Базовую категорию удалить нельзя');
    }
    // Снимаем категорию из whitelist (если была там), чтобы не осталась ссылка на удалённую.
    await this.availableCategoryService.removeAvailableCategory(platformSettings().coopname, categoryId);
    return true;
  }

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
    const availableCategories = await this.availableCategoryService.getAvailableCategories(platformSettings().coopname);

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
    const availableTree = await this.categoryTreeService.buildAvailableCategoryTree(platformSettings().coopname);
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
    const stats = await this.availableCategoryService.getAvailabilityStats(platformSettings().coopname);
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
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<AvailableCategoryDTO[]> {
    const availableCategories = await this.availableCategoryService.addMultipleCategories(
      platformSettings().coopname,
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
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<AvailableCategoryDTO[]> {
    const availableCategories = await this.availableCategoryService.addMultipleCategoryTypes(
      platformSettings().coopname,
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
    await this.availableCategoryService.removeMultipleCategories(platformSettings().coopname, input.categoryIds);
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
    await this.availableCategoryService.removeMultipleCategoryTypes(platformSettings().coopname, input.categoryTypes);
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
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<AvailableCategoryDTO[]> {
    const availableCategories = await this.availableCategoryService.replaceAvailableItems(
      platformSettings().coopname,
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
  async clearAvailableCategories(@CurrentUser() currentUser: IMonoAccount): Promise<boolean> {
    await this.availableCategoryService.replaceAvailableItems(platformSettings().coopname, [], [], currentUser?.username ?? 'system');
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
    const rules = await this.availableCategoryService.getCategoryRules(platformSettings().coopname, categoryId);
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
