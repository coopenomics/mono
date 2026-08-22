import { Inject, Injectable } from '@nestjs/common';
import { AvailableCategoryDomainEntity } from '../entities/available-category-domain.entity';
import {
  AvailableCategoryDomainRepository,
  AVAILABLE_CATEGORY_DOMAIN_REPOSITORY,
} from '../repositories/available-category-domain.repository';

/**
 * Доменный сервис для управления доступными категориями и типами товаров в кооперативе
 * Содержит бизнес-логику для работы с доступными категориями и типами товаров
 */
@Injectable()
export class AvailableCategoryDomainService {
  constructor(
    @Inject(AVAILABLE_CATEGORY_DOMAIN_REPOSITORY)
    private readonly availableCategoryRepository: AvailableCategoryDomainRepository
  ) {}

  /**
   * Получить все доступные категории и типы для кооператива
   */
  async getAvailableCategories(coopname: string): Promise<AvailableCategoryDomainEntity[]> {
    return this.availableCategoryRepository.findActiveByCoopname(coopname);
  }

  /**
   * Получить ID доступных категорий для кооператива (только целые категории)
   */
  async getAvailableCategoryIds(coopname: string): Promise<number[]> {
    return this.availableCategoryRepository.getAvailableCategoryIds(coopname);
  }

  /**
   * Получить ID доступных типов товаров для категории
   */
  async getAvailableTypeIds(coopname: string, categoryId: number): Promise<number[]> {
    return this.availableCategoryRepository.getAvailableTypeIds(coopname, categoryId);
  }

  /**
   * Проверить, доступна ли категория в кооперативе
   * Если нет настроенных категорий - все категории доступны
   */
  async isCategoryAvailable(coopname: string, categoryId: number): Promise<boolean> {
    // Проверяем, есть ли вообще настроенные категории для кооператива
    const totalCount = await this.availableCategoryRepository.countByCoopname(coopname);

    // Если нет настроенных категорий, то все категории доступны
    if (totalCount === 0) {
      return true;
    }

    // Если есть настроенные категории, проверяем конкретную
    return this.availableCategoryRepository.isCategoryAvailable(coopname, categoryId);
  }

  /**
   * Проверить, доступен ли конкретный тип товара в кооперативе
   * Если нет настроенных ограничений - все типы доступны
   */
  async isTypeAvailable(coopname: string, categoryId: number, typeId: number): Promise<boolean> {
    // Проверяем, есть ли вообще настроенные категории для кооператива
    const totalCount = await this.availableCategoryRepository.countByCoopname(coopname);

    // Если нет настроенных категорий, то все типы доступны
    if (totalCount === 0) {
      return true;
    }

    // Если есть настроенные категории, проверяем конкретный тип
    return this.availableCategoryRepository.isTypeAvailable(coopname, categoryId, typeId);
  }

  /**
   * Проверить, есть ли ограничения по категориям в кооперативе
   */
  async hasAvailabilityRestrictions(coopname: string): Promise<boolean> {
    const count = await this.availableCategoryRepository.countByCoopname(coopname);
    return count > 0;
  }

  /**
   * Добавить категорию в доступные для кооператива (вся категория)
   */
  async addAvailableCategory(coopname: string, categoryId: number, addedBy: string): Promise<AvailableCategoryDomainEntity> {
    return this.availableCategoryRepository.addCategory(coopname, categoryId, addedBy);
  }

  /**
   * Добавить конкретный тип товара в доступные для кооператива
   */
  async addAvailableCategoryType(
    coopname: string,
    categoryId: number,
    typeId: number,
    addedBy: string
  ): Promise<AvailableCategoryDomainEntity> {
    return this.availableCategoryRepository.addCategoryType(coopname, categoryId, typeId, addedBy);
  }

  /**
   * Удалить категорию из доступных для кооператива (включая все типы)
   */
  async removeAvailableCategory(coopname: string, categoryId: number): Promise<void> {
    await this.availableCategoryRepository.removeCategory(coopname, categoryId);
  }

  /**
   * Удалить конкретный тип товара из доступных для кооператива
   */
  async removeAvailableCategoryType(coopname: string, categoryId: number, typeId: number): Promise<void> {
    await this.availableCategoryRepository.removeCategoryType(coopname, categoryId, typeId);
  }

  /**
   * Массово добавить категории в доступные (целые категории)
   */
  async addMultipleCategories(
    coopname: string,
    categoryIds: number[],
    addedBy: string
  ): Promise<AvailableCategoryDomainEntity[]> {
    const availableCategories: AvailableCategoryDomainEntity[] = [];

    for (const categoryId of categoryIds) {
      const availableCategory = await this.addAvailableCategory(coopname, categoryId, addedBy);
      availableCategories.push(availableCategory);
    }

    return availableCategories;
  }

  /**
   * Массово добавить типы товаров в доступные
   */
  async addMultipleCategoryTypes(
    coopname: string,
    items: Array<{ categoryId: number; typeId: number }>,
    addedBy: string
  ): Promise<AvailableCategoryDomainEntity[]> {
    const availableCategories: AvailableCategoryDomainEntity[] = [];

    for (const item of items) {
      const availableCategory = await this.addAvailableCategoryType(coopname, item.categoryId, item.typeId, addedBy);
      availableCategories.push(availableCategory);
    }

    return availableCategories;
  }

  /**
   * Массово удалить категории из доступных
   */
  async removeMultipleCategories(coopname: string, categoryIds: number[]): Promise<void> {
    for (const categoryId of categoryIds) {
      await this.removeAvailableCategory(coopname, categoryId);
    }
  }

  /**
   * Массово удалить типы товаров из доступных
   */
  async removeMultipleCategoryTypes(coopname: string, items: Array<{ categoryId: number; typeId: number }>): Promise<void> {
    for (const item of items) {
      await this.removeAvailableCategoryType(coopname, item.categoryId, item.typeId);
    }
  }

  /**
   * Заменить все доступные категории и типы новым списком
   */
  async replaceAvailableItems(
    coopname: string,
    categories: number[],
    categoryTypes: Array<{ categoryId: number; typeId: number }>,
    addedBy: string
  ): Promise<AvailableCategoryDomainEntity[]> {
    // Получаем текущие доступные категории
    const current = await this.availableCategoryRepository.findByCoopname(coopname);

    // Удаляем все текущие
    for (const availableCategory of current) {
      await this.availableCategoryRepository.delete(availableCategory.id);
    }

    // Добавляем новые категории и типы
    const results: AvailableCategoryDomainEntity[] = [];

    // Добавляем целые категории
    const addedCategories = await this.addMultipleCategories(coopname, categories, addedBy);
    results.push(...addedCategories);

    // Добавляем конкретные типы
    const addedTypes = await this.addMultipleCategoryTypes(coopname, categoryTypes, addedBy);
    results.push(...addedTypes);

    return results;
  }

  /**
   * Получить статистику по доступным категориям
   */
  async getAvailabilityStats(coopname: string): Promise<{
    totalAvailable: number;
    categoriesCount: number;
    typesCount: number;
    hasRestrictions: boolean;
  }> {
    const all = await this.availableCategoryRepository.findActiveByCoopname(coopname);
    const categoriesCount = all.filter((item) => item.isForEntireCategory()).length;
    const typesCount = all.filter((item) => item.isForSpecificType()).length;
    const totalAvailable = all.length;
    const hasRestrictions = totalAvailable > 0;

    return {
      totalAvailable,
      categoriesCount,
      typesCount,
      hasRestrictions,
    };
  }

  /**
   * Фильтрация массива ID категорий по доступности в кооперативе
   */
  async filterAvailableCategoryIds(coopname: string, categoryIds: number[]): Promise<number[]> {
    const hasRestrictions = await this.hasAvailabilityRestrictions(coopname);

    // Если нет ограничений, возвращаем все
    if (!hasRestrictions) {
      return categoryIds;
    }

    // Если есть ограничения, фильтруем
    const filtered: number[] = [];
    for (const categoryId of categoryIds) {
      const isAvailable = await this.isCategoryAvailable(coopname, categoryId);
      if (isAvailable) {
        filtered.push(categoryId);
      }
    }
    return filtered;
  }

  /**
   * Фильтрация массива типов товаров по доступности в кооперативе
   */
  async filterAvailableTypes(
    coopname: string,
    types: Array<{ categoryId: number; typeId: number }>
  ): Promise<Array<{ categoryId: number; typeId: number }>> {
    const hasRestrictions = await this.hasAvailabilityRestrictions(coopname);

    // Если нет ограничений, возвращаем все
    if (!hasRestrictions) {
      return types;
    }

    // Если есть ограничения, фильтруем
    const filtered: Array<{ categoryId: number; typeId: number }> = [];
    for (const type of types) {
      const isAvailable = await this.isTypeAvailable(coopname, type.categoryId, type.typeId);
      if (isAvailable) {
        filtered.push(type);
      }
    }
    return filtered;
  }

  /**
   * Получить все доступные правила для конкретной категории
   */
  async getCategoryRules(coopname: string, categoryId: number): Promise<AvailableCategoryDomainEntity[]> {
    return this.availableCategoryRepository.findByCategoryId(coopname, categoryId);
  }
}

export const AVAILABLE_CATEGORY_DOMAIN_SERVICE = Symbol('AVAILABLE_CATEGORY_DOMAIN_SERVICE');
