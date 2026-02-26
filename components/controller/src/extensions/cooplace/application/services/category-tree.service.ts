import { Injectable, Inject } from '@nestjs/common';
import { CategoryTreeDomainService, CATEGORY_TREE_DOMAIN_SERVICE } from '../../domain/services/category-tree-domain.service';
import { CategoryDTO, ProductTypeDTO } from '../dto/category-tree.dto';
import { CategoryTreeStatsDTO } from '../dto/category-tree.dto';
import { GetCategoryTreeInput } from '../dto/get-category-tree-input.dto';

/**
 * Сервис приложения для работы с деревом категорий
 */
@Injectable()
export class CategoryTreeService {
  constructor(
    @Inject(CATEGORY_TREE_DOMAIN_SERVICE)
    private readonly categoryTreeDomainService: CategoryTreeDomainService
  ) {}

  /**
   * Получить полное дерево категорий с типами товаров
   */
  async getCategoryTree(input?: GetCategoryTreeInput): Promise<CategoryDTO[]> {
    const domainTree = await this.categoryTreeDomainService.buildCategoryTreeWithOptions({
      rootCategoryId: input?.rootCategoryId,
      onlyAvailable: input?.onlyAvailable,
      includeTypes: input?.includeTypes,
      maxDepth: input?.maxDepth,
    });

    return domainTree.map((category) => CategoryDTO.fromDomain(category));
  }

  /**
   * Получить дерево категорий с фильтрацией по доступности
   */
  async getAvailableCategoryTree(coopname?: string): Promise<CategoryDTO[]> {
    const domainTree = await this.categoryTreeDomainService.buildAvailableCategoryTree(coopname);
    return domainTree.map((category) => CategoryDTO.fromDomain(category));
  }

  /**
   * Получить все root-категории
   */
  async getRootCategories(): Promise<CategoryDTO[]> {
    const rootCategories = await this.categoryTreeDomainService.getRootCategories();
    return rootCategories.map((category) => CategoryDTO.fromDomain(category));
  }

  /**
   * Получить категорию по ID
   */
  async getCategoryById(categoryId: number): Promise<CategoryDTO | null> {
    const category = await this.categoryTreeDomainService.getCategoryById(categoryId);
    if (!category) return null;

    return CategoryDTO.fromDomain(category);
  }

  /**
   * Получить тип товара по ID
   */
  async getProductTypeById(typeId: number): Promise<ProductTypeDTO | null> {
    const type = await this.categoryTreeDomainService.getTypeById(typeId);
    if (!type) return null;

    return ProductTypeDTO.fromDomain(type);
  }

  /**
   * Универсальный поиск по дереву категорий и типов товаров
   * Возвращает дерево категорий на основе поискового запроса
   */
  async search(searchTerm: string): Promise<CategoryDTO[]> {
    const resultTree = await this.categoryTreeDomainService.search(searchTerm);
    return resultTree.map((category) => CategoryDTO.fromDomain(category));
  }

  /**
   * Получить статистику по дереву категорий
   */
  async getCategoryTreeStats(): Promise<CategoryTreeStatsDTO> {
    const stats = await this.categoryTreeDomainService.getCategoryTreeStats();
    return new CategoryTreeStatsDTO(stats);
  }
}

export const CATEGORY_TREE_SERVICE = Symbol('CATEGORY_TREE_SERVICE');
