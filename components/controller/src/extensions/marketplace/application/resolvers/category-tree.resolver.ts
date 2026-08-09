import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { Inject, UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { CategoryTreeService, CATEGORY_TREE_SERVICE } from '../services/category-tree.service';
import { CategoryTreeDomainService, CATEGORY_TREE_DOMAIN_SERVICE } from '../../domain/services/category-tree-domain.service';
import { CategoryDTO, ProductTypeDTO } from '../dto/category-tree.dto';
import { CategoryTreeStatsDTO } from '../dto/category-tree.dto';
import { GetCategoryTreeInput } from '../dto/get-category-tree-input.dto';
import { GetCategoryByIdInput } from '../dto/get-category-by-id-input.dto';
import { GetProductTypeByIdInput } from '../dto/get-product-type-by-id-input.dto';
import { SearchCategoriesInput } from '../dto/search-categories-input.dto';

/**
 * GraphQL резолвер для работы с деревом категорий marketplace.
 *
 * Доступ — пайщикам кооператива (через `MarketplaceMembershipGuard`).
 * Story 1.3 / 1.8: каталог категорий — закрытый ресурс marketplace, не публичный.
 */
@Resolver(() => CategoryDTO)
@UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
export class CategoryTreeResolver {
  constructor(
    @Inject(CATEGORY_TREE_SERVICE)
    private readonly categoryTreeService: CategoryTreeService,
    @Inject(CATEGORY_TREE_DOMAIN_SERVICE)
    private readonly categoryTreeDomainService: CategoryTreeDomainService
  ) {}

  @Query(() => [CategoryDTO], {
    name: 'marketplaceGetCategoryTree',
    description: 'Получить полное дерево категорий marketplace с типами товаров',
  })
  async getCategoryTree(
    @Args('input', { type: () => GetCategoryTreeInput, nullable: true })
    input?: GetCategoryTreeInput
  ): Promise<CategoryDTO[]> {
    return this.categoryTreeService.getCategoryTree(input);
  }

  @Query(() => [CategoryDTO], {
    name: 'marketplaceGetRootCategories',
    description: 'Получить все корневые категории marketplace',
  })
  async getRootCategories(): Promise<CategoryDTO[]> {
    return this.categoryTreeService.getRootCategories();
  }

  @Query(() => CategoryDTO, {
    name: 'marketplaceGetCategoryById',
    description: 'Получить категорию marketplace по ID',
    nullable: true,
  })
  async getCategoryById(
    @Args('data', { type: () => GetCategoryByIdInput })
    data: GetCategoryByIdInput
  ): Promise<CategoryDTO | null> {
    return this.categoryTreeService.getCategoryById(data.categoryId);
  }

  @Query(() => ProductTypeDTO, {
    name: 'marketplaceGetProductTypeById',
    description: 'Получить тип товара marketplace по ID',
    nullable: true,
  })
  async getProductTypeById(
    @Args('data', { type: () => GetProductTypeByIdInput })
    data: GetProductTypeByIdInput
  ): Promise<ProductTypeDTO | null> {
    return this.categoryTreeService.getProductTypeById(data.typeId);
  }

  @Query(() => [CategoryDTO], {
    name: 'marketplaceGetSearchCategories',
    description: 'Универсальный поиск по категориям и типам товаров',
  })
  async searchCategories(
    @Args('data', { type: () => SearchCategoriesInput })
    data: SearchCategoriesInput
  ): Promise<CategoryDTO[]> {
    return this.categoryTreeService.search(data.searchTerm);
  }

  @Query(() => CategoryTreeStatsDTO, {
    name: 'marketplaceGetCategoryTreeStats',
    description: 'Получить статистику по дереву категорий',
  })
  async getCategoryTreeStats(): Promise<CategoryTreeStatsDTO> {
    return this.categoryTreeService.getCategoryTreeStats();
  }
}
