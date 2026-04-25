import type { AvailableCategoryDomainEntity } from '../entities/available-category-domain.entity';

/**
 * Интерфейс доменного репозитория для управления доступными категориями и типами товаров
 */
export interface AvailableCategoryDomainRepository {
  /**
   * Получить все доступные категории и типы для кооператива
   */
  findByCoopname(coopname: string): Promise<AvailableCategoryDomainEntity[]>;

  /**
   * Получить активные доступные категории и типы для кооператива
   */
  findActiveByCoopname(coopname: string): Promise<AvailableCategoryDomainEntity[]>;

  /**
   * Найти доступную категорию/тип по кооперативу, ID категории и опционально ID типа
   */
  findByCoopnameAndCategoryId(
    coopname: string,
    categoryId: number,
    typeId?: number
  ): Promise<AvailableCategoryDomainEntity | null>;

  /**
   * Сохранить доступную категорию/тип
   */
  save(availableCategory: AvailableCategoryDomainEntity): Promise<AvailableCategoryDomainEntity>;

  /**
   * Сохранить несколько доступных категорий/типов
   */
  saveMany(availableCategories: AvailableCategoryDomainEntity[]): Promise<AvailableCategoryDomainEntity[]>;

  /**
   * Удалить доступную категорию/тип
   */
  delete(id: number): Promise<void>;

  /**
   * Добавить категорию в доступные для кооператива (вся категория)
   */
  addCategory(coopname: string, categoryId: number, addedBy: string): Promise<AvailableCategoryDomainEntity>;

  /**
   * Добавить конкретный тип товара в доступные для кооператива
   */
  addCategoryType(
    coopname: string,
    categoryId: number,
    typeId: number,
    addedBy: string
  ): Promise<AvailableCategoryDomainEntity>;

  /**
   * Удалить категорию из доступных для кооператива
   */
  removeCategory(coopname: string, categoryId: number): Promise<void>;

  /**
   * Удалить конкретный тип товара из доступных для кооператива
   */
  removeCategoryType(coopname: string, categoryId: number, typeId: number): Promise<void>;

  /**
   * Получить список ID доступных категорий для кооператива (только целые категории)
   */
  getAvailableCategoryIds(coopname: string): Promise<number[]>;

  /**
   * Получить список доступных типов товаров для категории в кооперативе
   */
  getAvailableTypeIds(coopname: string, categoryId: number): Promise<number[]>;

  /**
   * Проверить, доступна ли категория в кооперативе (любые типы или вся категория)
   */
  isCategoryAvailable(coopname: string, categoryId: number): Promise<boolean>;

  /**
   * Проверить, доступен ли конкретный тип товара в кооперативе
   */
  isTypeAvailable(coopname: string, categoryId: number, typeId: number): Promise<boolean>;

  /**
   * Получить количество доступных категорий в кооперативе
   */
  countByCoopname(coopname: string): Promise<number>;

  /**
   * Получить все доступные правила для конкретной категории
   */
  findByCategoryId(coopname: string, categoryId: number): Promise<AvailableCategoryDomainEntity[]>;

  /**
   * Обновить статус доступных категорий/типов
   */
  updateStatus(coopname: string, categoryIds: number[], isActive: boolean, typeId?: number): Promise<void>;
}

export const AVAILABLE_CATEGORY_DOMAIN_REPOSITORY = Symbol('AVAILABLE_CATEGORY_DOMAIN_REPOSITORY');
