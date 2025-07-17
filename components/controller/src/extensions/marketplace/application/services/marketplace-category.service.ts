import { Injectable, Inject } from '@nestjs/common';
import { CategoryTreeDomainService, CATEGORY_TREE_DOMAIN_SERVICE } from '../../domain/services/category-tree-domain.service';
import { CategoryDTO, CategoryTreeStatsDTO } from '../dto/category-tree.dto';
import { GetCategoryTreeInput, SearchCategoriesInput, GetLeafCategoriesInput } from '../dto/inputs.dto';
import { CategoryDomainEntity } from '../../domain/entities/category-domain.entity';

/**
 * Сервис приложения для работы с категориями marketplace
 * Связывает GraphQL слой с доменным слоем
 */
@Injectable()
export class MarketplaceCategoryService {
  constructor(
    @Inject(CATEGORY_TREE_DOMAIN_SERVICE)
    private readonly categoryTreeService: CategoryTreeDomainService
  ) {}

  /**
   * Получить дерево категорий
   */
  async getCategoryTree(input?: GetCategoryTreeInput): Promise<CategoryDTO[]> {
    let categories: CategoryDomainEntity[];

    // Если указан rootCategoryId, строим дерево от этой категории
    if (input?.rootCategoryId) {
      categories = await this.categoryTreeService.buildCategoryTreeFromRoot(input.rootCategoryId);
    } else {
      categories = await this.categoryTreeService.buildCategoryTree();
    }

    let result = categories.map((category) => CategoryDTO.fromDomain(category));

    // Применяем фильтры
    if (input?.onlyAvailable) {
      result = this.filterAvailableCategories(result);
    }

    if (input?.maxDepth && input.maxDepth > 0) {
      result = this.limitTreeDepth(result, input.maxDepth);
    }

    return result;
  }

  /**
   * Получить листовые категории
   */
  async getLeafCategories(input?: GetLeafCategoriesInput): Promise<CategoryDTO[]> {
    const categories = await this.categoryTreeService.findLeafCategories();

    let result = categories;

    if (input?.onlyAvailable) {
      result = categories.filter((cat) => !cat.disabled);
    }

    return result.map((category) => CategoryDTO.fromDomain(category));
  }

  /**
   * Поиск категорий
   */
  async searchCategories(input: SearchCategoriesInput): Promise<CategoryDTO[]> {
    const categories = await this.categoryTreeService.searchCategories(input.searchTerm);

    let result = categories;

    if (input.onlyAvailable) {
      result = categories.filter((cat) => !cat.disabled);
    }

    if (input.limit && input.limit > 0) {
      result = result.slice(0, input.limit);
    }

    return result.map((category) => CategoryDTO.fromDomain(category));
  }

  /**
   * Получить статистику дерева категорий
   */
  async getCategoryTreeStats(): Promise<CategoryTreeStatsDTO> {
    const stats = await this.categoryTreeService.getCategoryTreeStats();
    return new CategoryTreeStatsDTO(stats);
  }

  /**
   * Получить категорию с путем
   */
  async getCategoryWithPath(categoryId: number): Promise<CategoryDTO | null> {
    const result = await this.categoryTreeService.findCategoryWithPath(categoryId);

    if (!result) return null;

    const categoryDto = CategoryDTO.fromDomain(result.category);

    // Добавляем информацию о пути
    (categoryDto as any).pathCategories = result.path.map((cat) => CategoryDTO.fromDomain(cat));

    return categoryDto;
  }

  /**
   * Фильтрация доступных категорий (рекурсивно)
   */
  private filterAvailableCategories(categories: CategoryDTO[]): CategoryDTO[] {
    return categories
      .filter((category) => !category.disabled)
      .map((category) => {
        if (category.children && category.children.length > 0) {
          (category as any).children = this.filterAvailableCategories(category.children);
        }
        return category;
      });
  }

  /**
   * Ограничение глубины дерева
   */
  private limitTreeDepth(categories: CategoryDTO[], maxDepth: number, currentDepth = 1): CategoryDTO[] {
    if (currentDepth >= maxDepth) {
      // Удаляем детей на максимальной глубине
      return categories.map((category) => {
        const limitedCategory = { ...category };
        (limitedCategory as any).children = [];
        (limitedCategory as any).childrenCount = 0;
        return limitedCategory;
      });
    }

    return categories.map((category) => {
      if (category.children && category.children.length > 0) {
        (category as any).children = this.limitTreeDepth(category.children, maxDepth, currentDepth + 1);
      }
      return category;
    });
  }

  /**
   * Получить типы товаров для категории и её подкатегорий
   */
  async getTypesForCategoryTree(categoryId: number) {
    const types = await this.categoryTreeService.getTypesForCategoryTree(categoryId);

    return types.map((type) => ({
      typeId: type.typeId,
      typeName: type.typeName,
      disabled: type.disabled,
      descriptionCategoryId: type.descriptionCategoryId,
      isAvailable: !type.disabled,
    }));
  }

  /**
   * Валидация входных данных для дерева категорий
   */
  validateCategoryTreeInput(input?: GetCategoryTreeInput): string[] {
    const errors: string[] = [];

    if (input?.maxDepth && (input.maxDepth < 1 || input.maxDepth > 10)) {
      errors.push('Максимальная глубина должна быть от 1 до 10');
    }

    if (input?.rootCategoryId && input.rootCategoryId <= 0) {
      errors.push('ID корневой категории должен быть положительным числом');
    }

    return errors;
  }

  /**
   * Валидация входных данных для поиска категорий
   */
  validateSearchCategoriesInput(input: SearchCategoriesInput): string[] {
    const errors: string[] = [];

    if (!input.searchTerm || input.searchTerm.trim().length === 0) {
      errors.push('Текст для поиска не может быть пустым');
    }

    if (input.searchTerm && input.searchTerm.trim().length < 2) {
      errors.push('Текст для поиска должен содержать минимум 2 символа');
    }

    if (input.limit && (input.limit < 1 || input.limit > 100)) {
      errors.push('Лимит результатов должен быть от 1 до 100');
    }

    return errors;
  }
}
