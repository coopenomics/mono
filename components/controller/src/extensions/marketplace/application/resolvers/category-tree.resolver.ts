import { Resolver, Query, Args, ObjectType, Field } from '@nestjs/graphql';
import { Injectable, Inject } from '@nestjs/common';
import { CategoryTreeService, CATEGORY_TREE_SERVICE } from '../services/category-tree.service';
import { MarketplaceCategoryService } from '../services/marketplace-category.service';
import {
  CategoryDTO,
  CategoryTreeStatsDTO,
  CategoryTreeSearchResultDTO,
  ProductWithPathDTO,
  CategoryWithTypesDTO,
} from '../dto/category-tree.dto';
import { GetCategoryTreeInput, SearchCategoriesInput, GetLeafCategoriesInput } from '../dto/inputs.dto';
import { CategoryTreeDomainService, CATEGORY_TREE_DOMAIN_SERVICE } from '../../domain/services/category-tree-domain.service';

/**
 * GraphQL резолвер для дерева категорий marketplace с функциональностью поиска
 * Теперь поддерживает фильтрацию по доступным категориям в кооперативе
 */
@Resolver(() => CategoryDTO)
@Injectable()
export class CategoryTreeResolver {
  constructor(
    @Inject(CATEGORY_TREE_SERVICE)
    private readonly categoryTreeService: CategoryTreeService,
    private readonly marketplaceCategoryService: MarketplaceCategoryService,
    @Inject(CATEGORY_TREE_DOMAIN_SERVICE)
    private readonly categoryTreeDomainService: CategoryTreeDomainService
  ) {}

  /**
   * Получить полное дерево категорий с типами товаров
   * Теперь фильтрует по доступным категориям в кооперативе
   */
  @Query(() => [CategoryDTO], {
    name: 'getMarketplaceCategoryTree',
    description: 'Получить дерево категорий и типов товаров marketplace (с учетом доступности в кооперативе)',
  })
  async getCategoryTree(
    @Args('input', { type: () => GetCategoryTreeInput, nullable: true })
    input?: GetCategoryTreeInput
  ): Promise<CategoryDTO[]> {
    // Используем новый метод с фильтрацией по доступности
    const availableTree = await this.categoryTreeDomainService.buildAvailableCategoryTree();
    let result = availableTree.map((category) => CategoryDTO.fromDomain(category));

    // Применяем дополнительные фильтры из input
    if (input?.onlyAvailable) {
      result = this.filterAvailableCategories(result);
    }

    if (input?.maxDepth && input.maxDepth > 0) {
      result = this.limitTreeDepth(result, input.maxDepth);
    }

    return result;
  }

  /**
   * Поиск по дереву категорий и типов товаров
   */
  @Query(() => CategoryTreeSearchResultDTO, {
    name: 'marketplaceSearchCategoryTree',
    description: 'Поиск по дереву категорий и типов товаров с построением отфильтрованного дерева',
  })
  async searchCategoryTree(
    @Args('searchTerm', { type: () => String, description: 'Поисковый запрос' }) searchTerm: string
  ): Promise<CategoryTreeSearchResultDTO> {
    return this.categoryTreeService.searchCategoryTree(searchTerm);
  }

  /**
   * Поиск товаров с показом полного пути к категории
   */
  @Query(() => [ProductWithPathDTO], {
    name: 'marketplaceSearchProductsWithPath',
    description: 'Поиск типов товаров с показом полного пути к категории',
  })
  async searchProductsWithPath(
    @Args('searchTerm', { type: () => String, description: 'Поисковый запрос' }) searchTerm: string
  ): Promise<ProductWithPathDTO[]> {
    return this.categoryTreeService.searchProductsWithPath(searchTerm);
  }

  /**
   * Поиск категорий с их типами
   */
  @Query(() => [CategoryWithTypesDTO], {
    name: 'marketplaceSearchCategoriesWithTypes',
    description: 'Поиск категорий с их типами товаров',
  })
  async searchCategoriesWithTypes(
    @Args('searchTerm', { type: () => String, description: 'Поисковый запрос' }) searchTerm: string
  ): Promise<CategoryWithTypesDTO[]> {
    return this.categoryTreeService.searchCategoriesWithTypes(searchTerm);
  }

  /**
   * Получить корневые категории
   */
  @Query(() => [CategoryDTO], {
    name: 'getMarketplaceRootCategories',
    description: 'Получить корневые категории marketplace',
  })
  async getRootCategories(): Promise<CategoryDTO[]> {
    return this.categoryTreeService.buildCategoryTree();
  }

  /**
   * Получить листовые категории (где можно создавать товары)
   * Теперь учитывает доступность категорий в кооперативе
   */
  @Query(() => [CategoryDTO], {
    name: 'getMarketplaceLeafCategories',
    description: 'Получить листовые категории marketplace (где можно создавать товары) с учетом доступности в кооперативе',
  })
  async getLeafCategories(
    @Args('input', { type: () => GetLeafCategoriesInput, nullable: true })
    input?: GetLeafCategoriesInput
  ): Promise<CategoryDTO[]> {
    // Используем новый метод с фильтрацией по доступности
    const availableLeafCategories = await this.categoryTreeDomainService.findAvailableLeafCategories();
    let result = availableLeafCategories.map((category) => CategoryDTO.fromDomain(category));

    if (input?.onlyAvailable) {
      result = result.filter((cat) => !cat.disabled);
    }

    return result;
  }

  /**
   * Поиск категорий по названию
   * Теперь учитывает доступность категорий в кооперативе
   */
  @Query(() => [CategoryDTO], {
    name: 'searchMarketplaceCategories',
    description: 'Поиск категорий marketplace по названию с учетом доступности в кооперативе',
  })
  async searchCategories(
    @Args('input', { type: () => SearchCategoriesInput })
    input: SearchCategoriesInput
  ): Promise<CategoryDTO[]> {
    // Используем новый метод с фильтрацией по доступности
    const availableCategories = await this.categoryTreeDomainService.searchAvailableCategories(input.searchTerm);
    let filteredCategories = availableCategories.map((category) => CategoryDTO.fromDomain(category));

    if (input.onlyAvailable) {
      filteredCategories = filteredCategories.filter((cat) => !cat.disabled);
    }

    if (input.limit && input.limit > 0) {
      filteredCategories = filteredCategories.slice(0, input.limit);
    }

    return filteredCategories;
  }

  /**
   * Получить статистику по дереву категорий
   */
  @Query(() => CategoryTreeStatsDTO, {
    name: 'getMarketplaceCategoryTreeStats',
    description: 'Получить статистику по дереву категорий marketplace',
  })
  async getCategoryTreeStats(): Promise<CategoryTreeStatsDTO> {
    return this.categoryTreeService.getCategoryTreeStats();
  }

  /**
   * Получить категорию с полным путем
   */
  @Query(() => CategoryWithPathResult, {
    name: 'getMarketplaceCategoryWithPath',
    description: 'Получить категорию marketplace с полным путем',
    nullable: true,
  })
  async getCategoryWithPath(
    @Args('categoryId', { type: () => Number, description: 'ID категории' }) categoryId: number
  ): Promise<{ category: CategoryDTO; path: CategoryDTO[] } | null> {
    return this.categoryTreeService.findCategoryWithPath(categoryId);
  }

  /**
   * Фильтрация доступных категорий (рекурсивно)
   */
  private filterAvailableCategories(categories: CategoryDTO[]): CategoryDTO[] {
    return categories
      .filter((category) => !category.disabled)
      .map((category) => {
        if (category.children && category.children.length > 0) {
          const filteredChildren = this.filterAvailableCategories(category.children);
          return new CategoryDTO({
            ...category,
            children: filteredChildren,
          });
        }
        return category;
      });
  }

  /**
   * Ограничение глубины дерева
   */
  private limitTreeDepth(categories: CategoryDTO[], maxDepth: number): CategoryDTO[] {
    if (maxDepth <= 1) {
      return categories;
    }

    return categories.map((category) => {
      if (category.children && category.children.length > 0) {
        const limitedChildren = this.limitTreeDepth(category.children, maxDepth - 1);
        return new CategoryDTO({
          ...category,
          children: limitedChildren,
        });
      }
      return category;
    });
  }
}

/**
 * Вспомогательный тип для GraphQL
 */
@ObjectType('MarketplaceCategoryWithPath')
class CategoryWithPathResult {
  @Field(() => CategoryDTO)
  category!: CategoryDTO;

  @Field(() => [CategoryDTO])
  path!: CategoryDTO[];
}
