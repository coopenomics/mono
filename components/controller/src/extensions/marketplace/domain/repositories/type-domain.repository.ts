import type { TypeDomainEntity } from '../entities/type-domain.entity';
import type { CategoryDomainEntity } from '../entities/category-domain.entity';

/**
 * Интерфейс доменного репозитория для типов товаров marketplace
 */
export interface TypeDomainRepository {
  /**
   * Получить все типы товаров
   */
  findAll(): Promise<TypeDomainEntity[]>;

  /**
   * Найти тип товара по ID
   */
  findById(id: number): Promise<TypeDomainEntity | null>;

  /**
   * Найти типы товаров по ID категории
   */
  findByCategoryId(categoryId: number): Promise<TypeDomainEntity[]>;

  /**
   * Найти доступные типы товаров (не отключенные)
   */
  findAvailable(): Promise<TypeDomainEntity[]>;

  /**
   * Найти типы товаров по названию
   */
  findByName(name: string): Promise<TypeDomainEntity[]>;

  /**
   * Сохранить тип товара
   */
  save(type: TypeDomainEntity): Promise<TypeDomainEntity>;

  /**
   * Сохранить несколько типов товаров
   */
  saveMany(types: TypeDomainEntity[]): Promise<TypeDomainEntity[]>;

  /**
   * Обновить или создать тип товара
   */
  upsert(typeData: Partial<TypeDomainEntity>): Promise<TypeDomainEntity>;

  /**
   * Подсчитать количество типов товаров
   */
  count(): Promise<number>;

  /**
   * Найти типы товаров с атрибутами
   */
  findWithAttributes(): Promise<TypeDomainEntity[]>;

  /**
   * Найти типы товаров по ID категории с атрибутами
   */
  findByCategoryIdWithAttributes(categoryId: number): Promise<TypeDomainEntity[]>;

  /**
   * Поиск типов товаров по названию (оптимизированный)
   */
  searchByName(searchTerm: string, limit?: number): Promise<TypeDomainEntity[]>;

  /**
   * Поиск типов товаров по названию с информацией о категории
   */
  searchByNameWithCategory(
    searchTerm: string,
    limit?: number
  ): Promise<
    {
      type: TypeDomainEntity;
      categoryPath: CategoryDomainEntity[];
      fullPath: string;
    }[]
  >;
}

// Токен для внедрения зависимости
export const TYPE_DOMAIN_REPOSITORY = Symbol('TypeDomainRepository');
