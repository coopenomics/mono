import { Inject, Injectable } from '@nestjs/common';
import { CategoryTreeDomainService, CATEGORY_TREE_DOMAIN_SERVICE } from '../../domain/services/category-tree-domain.service';
import {
  CategoryDTO,
  ProductTypeDTO,
  CategoryTreeStatsDTO,
  CategoryTreeSearchResultDTO,
  ProductWithPathDTO,
  CategoryWithTypesDTO,
} from '../dto/category-tree.dto';

/**
 * Application сервис для работы с деревом категорий и поиском
 */
@Injectable()
export class CategoryTreeService {
  constructor(
    @Inject(CATEGORY_TREE_DOMAIN_SERVICE)
    private readonly categoryTreeDomainService: CategoryTreeDomainService
  ) {}

  /**
   * Построить полное дерево категорий
   */
  async buildCategoryTree(): Promise<CategoryDTO[]> {
    const domainTree = await this.categoryTreeDomainService.buildCategoryTree();
    return domainTree.map((category) => CategoryDTO.fromDomain(category));
  }

  /**
   * Построить дерево категорий начиная с конкретной категории
   */
  async buildCategoryTreeFromRoot(rootCategoryId: number): Promise<CategoryDTO[]> {
    const domainTree = await this.categoryTreeDomainService.buildCategoryTreeFromRoot(rootCategoryId);
    return domainTree.map((category) => CategoryDTO.fromDomain(category));
  }

  /**
   * Поиск по дереву категорий и типов товаров
   */
  async searchCategoryTree(searchTerm: string): Promise<CategoryTreeSearchResultDTO> {
    const searchResult = await this.categoryTreeDomainService.searchCategoryTree(searchTerm);

    return new CategoryTreeSearchResultDTO({
      matchedCategories: searchResult.matchedCategories.map((cat) => CategoryDTO.fromDomain(cat)),
      matchedTypes: searchResult.matchedTypes.map((type) => ProductTypeDTO.fromDomain(type)),
      resultTree: searchResult.resultTree.map((cat) => CategoryDTO.fromDomain(cat)),
    });
  }

  /**
   * Поиск товаров с показом полного пути к категории
   */
  async searchProductsWithPath(searchTerm: string): Promise<ProductWithPathDTO[]> {
    const searchResults = await this.categoryTreeDomainService.searchProductsWithCategoryPath(searchTerm);

    return searchResults.map(
      (result) =>
        new ProductWithPathDTO({
          type: ProductTypeDTO.fromDomain(result.type),
          categoryPath: result.categoryPath.map((cat) => CategoryDTO.fromDomain(cat)),
          fullPath: result.fullPath,
        })
    );
  }

  /**
   * Поиск категорий с их типами
   */
  async searchCategoriesWithTypes(searchTerm: string): Promise<CategoryWithTypesDTO[]> {
    const searchResults = await this.categoryTreeDomainService.searchCategoriesWithTypes(searchTerm);

    return searchResults.map(
      (result) =>
        new CategoryWithTypesDTO({
          category: CategoryDTO.fromDomain(result.category),
          matchedTypes: result.matchedTypes.map((type) => ProductTypeDTO.fromDomain(type)),
          allTypes: result.allTypes.map((type) => ProductTypeDTO.fromDomain(type)),
          categoryPath: result.categoryPath.map((cat) => CategoryDTO.fromDomain(cat)),
        })
    );
  }

  /**
   * Найти листовые категории
   */
  async findLeafCategories(): Promise<CategoryDTO[]> {
    const leafCategories = await this.categoryTreeDomainService.findLeafCategories();
    return leafCategories.map((category) => CategoryDTO.fromDomain(category));
  }

  /**
   * Найти категорию с полным путем
   */
  async findCategoryWithPath(categoryId: number): Promise<{ category: CategoryDTO; path: CategoryDTO[] } | null> {
    const result = await this.categoryTreeDomainService.findCategoryWithPath(categoryId);

    if (!result) {
      return null;
    }

    return {
      category: CategoryDTO.fromDomain(result.category),
      path: result.path.map((cat) => CategoryDTO.fromDomain(cat)),
    };
  }

  /**
   * Получить статистику дерева категорий
   */
  async getCategoryTreeStats(): Promise<CategoryTreeStatsDTO> {
    const stats = await this.categoryTreeDomainService.getCategoryTreeStats();
    return new CategoryTreeStatsDTO(stats);
  }

  /**
   * Поиск категорий по названию
   */
  async searchCategories(searchTerm: string): Promise<CategoryDTO[]> {
    const categories = await this.categoryTreeDomainService.searchCategories(searchTerm);
    return categories.map((category) => CategoryDTO.fromDomain(category));
  }
}

export const CATEGORY_TREE_SERVICE = Symbol('CATEGORY_TREE_SERVICE');
