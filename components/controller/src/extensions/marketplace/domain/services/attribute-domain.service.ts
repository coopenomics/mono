import { Inject, Injectable } from '@nestjs/common';
import type { AttributeDomainEntity } from '../entities/attribute-domain.entity';
import type { DictionaryDomainEntity } from '../entities/dictionary-domain.entity';
import type { DictionaryValueDomainEntity } from '../entities/dictionary-value-domain.entity';
import { AttributeDomainRepository, ATTRIBUTE_DOMAIN_REPOSITORY } from '../repositories/attribute-domain.repository';
import { DictionaryDomainRepository, DICTIONARY_DOMAIN_REPOSITORY } from '../repositories/dictionary-domain.repository';
import {
  DictionaryValueDomainRepository,
  DICTIONARY_VALUE_DOMAIN_REPOSITORY,
} from '../repositories/dictionary-value-domain.repository';

/**
 * Доменный сервис для работы с атрибутами товаров и их значениями
 */
@Injectable()
export class AttributeDomainService {
  constructor(
    @Inject(ATTRIBUTE_DOMAIN_REPOSITORY)
    private readonly attributeRepository: AttributeDomainRepository,
    @Inject(DICTIONARY_DOMAIN_REPOSITORY)
    private readonly dictionaryRepository: DictionaryDomainRepository,
    @Inject(DICTIONARY_VALUE_DOMAIN_REPOSITORY)
    private readonly dictionaryValueRepository: DictionaryValueDomainRepository
  ) {}

  /**
   * Получить атрибуты для конкретной категории и типа товара
   */
  async getAttributesForCategoryType(categoryId: number, typeId: number): Promise<AttributeDomainEntity[]> {
    return this.attributeRepository.findByCategoryAndType(categoryId, typeId);
  }

  /**
   * Получить атрибуты с их словарными значениями
   */
  async getAttributesWithDictionaryValues(
    categoryId: number,
    typeId: number
  ): Promise<
    Array<{
      attribute: AttributeDomainEntity;
      dictionary?: DictionaryDomainEntity;
      values?: DictionaryValueDomainEntity[];
    }>
  > {
    const attributes = await this.getAttributesForCategoryType(categoryId, typeId);
    const result: Array<{
      attribute: AttributeDomainEntity;
      dictionary?: DictionaryDomainEntity;
      values?: DictionaryValueDomainEntity[];
    }> = [];

    for (const attribute of attributes) {
      const item: {
        attribute: AttributeDomainEntity;
        dictionary?: DictionaryDomainEntity;
        values?: DictionaryValueDomainEntity[];
      } = { attribute };

      if (attribute.hasDictionary() && attribute.dictionaryId) {
        const dictionary = await this.dictionaryRepository.findById(attribute.dictionaryId);
        if (dictionary) {
          item.dictionary = dictionary;
          item.values = await this.dictionaryValueRepository.findByDictionaryId(attribute.dictionaryId);
        }
      }

      result.push(item);
    }

    return result;
  }

  /**
   * Поиск значений словаря по тексту
   */
  async searchDictionaryValues(
    dictionaryId: number,
    searchText: string,
    limit = 50
  ): Promise<DictionaryValueDomainEntity[]> {
    const values = await this.dictionaryValueRepository.searchByText(searchText, dictionaryId);
    return values.slice(0, limit);
  }

  /**
   * Получить группированные атрибуты
   */
  async getGroupedAttributes(categoryId: number, typeId: number): Promise<Map<string, AttributeDomainEntity[]>> {
    const attributes = await this.getAttributesForCategoryType(categoryId, typeId);
    const grouped = new Map<string, AttributeDomainEntity[]>();

    for (const attribute of attributes) {
      const groupName = attribute.groupName || 'Без группы';

      if (!grouped.has(groupName)) {
        grouped.set(groupName, []);
      }

      const group = grouped.get(groupName);
      if (group) {
        group.push(attribute);
      }
    }

    return grouped;
  }

  /**
   * Получить обязательные атрибуты для категории и типа
   */
  async getRequiredAttributes(categoryId: number, typeId: number): Promise<AttributeDomainEntity[]> {
    const attributes = await this.getAttributesForCategoryType(categoryId, typeId);
    return attributes.filter((attr) => attr.isRequired);
  }

  /**
   * Получить аспектные атрибуты для категории и типа
   */
  async getAspectAttributes(categoryId: number, typeId: number): Promise<AttributeDomainEntity[]> {
    const attributes = await this.getAttributesForCategoryType(categoryId, typeId);
    return attributes.filter((attr) => attr.isAspect);
  }

  /**
   * Валидация значений атрибута
   */
  async validateAttributeValues(
    attributeId: number,
    values: any[]
  ): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const attribute = await this.attributeRepository.findById(attributeId);
    if (!attribute) {
      return {
        isValid: false,
        errors: ['Атрибут не найден'],
      };
    }

    const errors: string[] = [];

    // Проверка количества значений
    const maxValues = attribute.getMaxValues();
    if (values.length > maxValues) {
      errors.push(`Превышено максимальное количество значений: ${maxValues}`);
    }

    // Проверка обязательности
    if (attribute.isRequired && values.length === 0) {
      errors.push('Атрибут является обязательным');
    }

    // Проверка для коллекции
    if (!attribute.isCollection && values.length > 1) {
      errors.push('Атрибут не поддерживает множественные значения');
    }

    // Проверка словарных значений
    if (attribute.hasDictionary() && attribute.dictionaryId) {
      const dictionaryValues = await this.dictionaryValueRepository.findByDictionaryId(attribute.dictionaryId);
      const validValueIds = dictionaryValues.map((v) => v.dictionaryValueId);

      for (const value of values) {
        if (typeof value === 'number' && !validValueIds.includes(value)) {
          errors.push(`Недопустимое значение словаря: ${value}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Получить статистику по атрибутам
   */
  async getAttributeStats(): Promise<{
    totalAttributes: number;
    requiredAttributes: number;
    aspectAttributes: number;
    dictionaryAttributes: number;
    totalDictionaries: number;
    totalDictionaryValues: number;
  }> {
    const [
      totalAttributes,
      requiredAttributes,
      aspectAttributes,
      dictionaryAttributes,
      totalDictionaries,
      totalDictionaryValues,
    ] = await Promise.all([
      this.attributeRepository.count(),
      this.attributeRepository.findRequired().then((attrs) => attrs.length),
      this.attributeRepository.findAspect().then((attrs) => attrs.length),
      this.attributeRepository.findWithDictionary().then((attrs) => attrs.length),
      this.dictionaryRepository.count(),
      this.dictionaryValueRepository.count(),
    ]);

    return {
      totalAttributes,
      requiredAttributes,
      aspectAttributes,
      dictionaryAttributes,
      totalDictionaries,
      totalDictionaryValues,
    };
  }

  /**
   * Поиск атрибутов по названию
   */
  async searchAttributes(searchTerm: string): Promise<AttributeDomainEntity[]> {
    const allAttributes = await this.attributeRepository.findAll();

    const lowerSearchTerm = searchTerm.toLowerCase();
    return allAttributes.filter(
      (attribute) =>
        attribute.name.toLowerCase().includes(lowerSearchTerm) ||
        (attribute.description && attribute.description.toLowerCase().includes(lowerSearchTerm))
    );
  }

  /**
   * Поиск атрибутов с фильтрами (доменная логика)
   */
  async searchAttributesWithFilters(options: {
    searchTerm: string;
    categoryId?: number;
    typeId?: number;
    onlyRequired?: boolean;
    onlyAspect?: boolean;
    onlyWithDictionary?: boolean;
    limit?: number;
  }): Promise<AttributeDomainEntity[]> {
    let attributes = await this.searchAttributes(options.searchTerm);

    // Дополнительная фильтрация по категории/типу
    if (options.categoryId && options.typeId) {
      const categoryTypeAttributes = await this.getAttributesForCategoryType(options.categoryId, options.typeId);
      const categoryTypeAttributeIds = categoryTypeAttributes.map((attr) => attr.attributeId);
      attributes = attributes.filter((attr) => categoryTypeAttributeIds.includes(attr.attributeId));
    }

    // Применяем фильтры
    if (options.onlyRequired) {
      attributes = attributes.filter((attr) => attr.isRequired);
    }

    if (options.onlyAspect) {
      attributes = attributes.filter((attr) => attr.isAspect);
    }

    if (options.onlyWithDictionary) {
      attributes = attributes.filter((attr) => attr.hasDictionary());
    }

    // Ограничиваем результаты
    if (options.limit && options.limit > 0) {
      attributes = attributes.slice(0, options.limit);
    }

    return attributes;
  }

  /**
   * Получить атрибуты для категории и типа с фильтрами (доменная логика)
   */
  async getAttributesForCategoryTypeWithFilters(options: {
    categoryId: number;
    typeId: number;
    includeDictionaryValues?: boolean;
    onlyRequired?: boolean;
  }): Promise<{
    attributes: AttributeDomainEntity[];
    attributesWithValues?: Array<{
      attribute: AttributeDomainEntity;
      dictionary?: DictionaryDomainEntity;
      values?: DictionaryValueDomainEntity[];
    }>;
  }> {
    let attributes: AttributeDomainEntity[];
    let attributesWithValues:
      | Array<{
          attribute: AttributeDomainEntity;
          dictionary?: DictionaryDomainEntity;
          values?: DictionaryValueDomainEntity[];
        }>
      | undefined;

    if (options.includeDictionaryValues) {
      const withValues = await this.getAttributesWithDictionaryValues(options.categoryId, options.typeId);
      attributes = withValues.map((item) => item.attribute);
      attributesWithValues = withValues;
    } else {
      attributes = await this.getAttributesForCategoryType(options.categoryId, options.typeId);
    }

    if (options.onlyRequired) {
      attributes = attributes.filter((attr) => attr.isRequired);
      if (attributesWithValues) {
        attributesWithValues = attributesWithValues.filter((item) => item.attribute.isRequired);
      }
    }

    return {
      attributes,
      attributesWithValues,
    };
  }
}
