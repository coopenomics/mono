import type { CategoryDomainEntity } from '../entities/category-domain.entity';

/**
 * Интерфейс доменного репозитория для категорий marketplace
 */
export interface CategoryDomainRepository {
  /**
   * Получить все категории
   */
  findAll(): Promise<CategoryDomainEntity[]>;

  /**
   * Найти категорию по ID
   */
  findById(id: number): Promise<CategoryDomainEntity | null>;

  /**
   * Найти корневые категории (без родителя)
   */
  findRootCategories(): Promise<CategoryDomainEntity[]>;

  /**
   * Найти дочерние категории по ID родителя
   */
  findByParentId(parentId: number): Promise<CategoryDomainEntity[]>;

  /**
   * Получить полное дерево категорий с иерархией
   */
  findWithHierarchy(): Promise<CategoryDomainEntity[]>;

  /**
   * Сохранить категорию
   */
  save(category: CategoryDomainEntity): Promise<CategoryDomainEntity>;

  /**
   * Сохранить несколько категорий
   */
  saveMany(categories: CategoryDomainEntity[]): Promise<CategoryDomainEntity[]>;

  /**
   * Обновить или создать категорию
   */
  upsert(categoryData: Partial<CategoryDomainEntity>): Promise<CategoryDomainEntity>;

  /**
   * Подсчитать количество категорий
   */
  count(): Promise<number>;

  /**
   * Найти листовые категории (без дочерних элементов)
   */
  findLeafCategories(): Promise<CategoryDomainEntity[]>;

  /**
   * Найти категории по названию
   */
  findByName(name: string): Promise<CategoryDomainEntity[]>;

  /**
   * Найти доступные категории (не отключенные)
   */
  findAvailable(): Promise<CategoryDomainEntity[]>;

  /**
   * Поиск категорий по названию (оптимизированный)
   */
  searchByName(searchTerm: string, limit?: number): Promise<CategoryDomainEntity[]>;

  /**
   * Поиск категорий по названию с полным путем
   */
  searchByNameWithPath(
    searchTerm: string,
    limit?: number
  ): Promise<
    {
      category: CategoryDomainEntity;
      path: CategoryDomainEntity[];
    }[]
  >;
}

// Токен для внедрения зависимости
export const CATEGORY_DOMAIN_REPOSITORY = Symbol('CategoryDomainRepository');
