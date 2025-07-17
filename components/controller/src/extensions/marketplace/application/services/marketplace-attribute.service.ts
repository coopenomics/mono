import { Injectable } from '@nestjs/common';
import { AttributeDomainService } from '../../domain/services/attribute-domain.service';
import { AttributeDTO, AttributeGroupDTO, AttributeStatsDTO, DictionaryValueDTO } from '../dto/attribute.dto';
import {
  GetCategoryAttributesInput,
  SearchAttributesInput,
  SearchDictionaryValuesInput,
  ValidateAttributeValuesInput,
} from '../dto/inputs.dto';

/**
 * Результат валидации атрибута
 */
export interface AttributeValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Сервис приложения для работы с атрибутами marketplace
 * Связывает GraphQL слой с доменным слоем
 */
@Injectable()
export class MarketplaceAttributeService {
  constructor(private readonly attributeService: AttributeDomainService) {}

  /**
   * Получить атрибуты для категории и типа товара
   */
  async getCategoryAttributes(input: GetCategoryAttributesInput): Promise<AttributeDTO[]> {
    // Валидация входных данных
    const validationErrors = this.validateCategoryAttributesInput(input);
    if (validationErrors.length > 0) {
      throw new Error(`Ошибки валидации: ${validationErrors.join(', ')}`);
    }

    let attributes;

    if (input.includeDictionaryValues) {
      const attributesWithValues = await this.attributeService.getAttributesWithDictionaryValues(
        input.categoryId,
        input.typeId
      );
      attributes = attributesWithValues.map((item) => item.attribute);
    } else {
      attributes = await this.attributeService.getAttributesForCategoryType(input.categoryId, input.typeId);
    }

    if (input.onlyRequired) {
      attributes = attributes.filter((attr) => attr.isRequired);
    }

    return attributes.map((attr) => AttributeDTO.fromDomain(attr, input.includeDictionaryValues));
  }

  /**
   * Получить группированные атрибуты
   */
  async getCategoryAttributesGrouped(input: GetCategoryAttributesInput): Promise<AttributeGroupDTO[]> {
    // Валидация входных данных
    const validationErrors = this.validateCategoryAttributesInput(input);
    if (validationErrors.length > 0) {
      throw new Error(`Ошибки валидации: ${validationErrors.join(', ')}`);
    }

    const groupedAttributes = await this.attributeService.getGroupedAttributes(input.categoryId, input.typeId);

    const result: AttributeGroupDTO[] = [];

    for (const [groupName, attributes] of groupedAttributes.entries()) {
      let filteredAttributes = attributes;

      if (input.onlyRequired) {
        filteredAttributes = attributes.filter((attr) => attr.isRequired);
      }

      if (filteredAttributes.length > 0) {
        const groupId = filteredAttributes[0].groupId;
        result.push(
          new AttributeGroupDTO({
            groupId,
            groupName,
            attributes: filteredAttributes.map((attr) => AttributeDTO.fromDomain(attr, input.includeDictionaryValues)),
          })
        );
      }
    }

    // Сортируем группы по названию
    return result.sort((a, b) => a.groupName.localeCompare(b.groupName));
  }

  /**
   * Получить обязательные атрибуты
   */
  async getRequiredAttributes(categoryId: number, typeId: number): Promise<AttributeDTO[]> {
    if (categoryId <= 0 || typeId <= 0) {
      throw new Error('ID категории и типа должны быть положительными числами');
    }

    const attributes = await this.attributeService.getRequiredAttributes(categoryId, typeId);
    return attributes.map((attr) => AttributeDTO.fromDomain(attr));
  }

  /**
   * Получить аспектные атрибуты
   */
  async getAspectAttributes(categoryId: number, typeId: number): Promise<AttributeDTO[]> {
    if (categoryId <= 0 || typeId <= 0) {
      throw new Error('ID категории и типа должны быть положительными числами');
    }

    const attributes = await this.attributeService.getAspectAttributes(categoryId, typeId);
    return attributes.map((attr) => AttributeDTO.fromDomain(attr));
  }

  /**
   * Поиск атрибутов
   */
  async searchAttributes(input: SearchAttributesInput): Promise<AttributeDTO[]> {
    // Валидация входных данных
    const validationErrors = this.validateSearchAttributesInput(input);
    if (validationErrors.length > 0) {
      throw new Error(`Ошибки валидации: ${validationErrors.join(', ')}`);
    }

    let attributes = await this.attributeService.searchAttributes(input.searchTerm);

    // Дополнительная фильтрация по категории/типу
    if (input.categoryId && input.typeId) {
      const categoryTypeAttributes = await this.attributeService.getAttributesForCategoryType(
        input.categoryId,
        input.typeId
      );
      const categoryTypeAttributeIds = categoryTypeAttributes.map((attr) => attr.attributeId);
      attributes = attributes.filter((attr) => categoryTypeAttributeIds.includes(attr.attributeId));
    }

    // Применяем фильтры
    if (input.onlyRequired) {
      attributes = attributes.filter((attr) => attr.isRequired);
    }

    if (input.onlyAspect) {
      attributes = attributes.filter((attr) => attr.isAspect);
    }

    if (input.onlyWithDictionary) {
      attributes = attributes.filter((attr) => attr.hasDictionary());
    }

    // Ограничиваем результаты
    if (input.limit && input.limit > 0) {
      attributes = attributes.slice(0, input.limit);
    }

    return attributes.map((attr) => AttributeDTO.fromDomain(attr));
  }

  /**
   * Поиск значений словаря
   */
  async searchDictionaryValues(input: SearchDictionaryValuesInput): Promise<DictionaryValueDTO[]> {
    // Валидация входных данных
    const validationErrors = this.validateSearchDictionaryValuesInput(input);
    if (validationErrors.length > 0) {
      throw new Error(`Ошибки валидации: ${validationErrors.join(', ')}`);
    }

    const values = await this.attributeService.searchDictionaryValues(
      input.dictionaryId,
      input.searchTerm,
      input.limit || 50
    );

    return values.map((value) => DictionaryValueDTO.fromDomain(value));
  }

  /**
   * Валидация значений атрибута
   */
  async validateAttributeValues(input: ValidateAttributeValuesInput): Promise<AttributeValidationResult> {
    if (input.attributeId <= 0) {
      return {
        isValid: false,
        errors: ['ID атрибута должен быть положительным числом'],
      };
    }

    if (!Array.isArray(input.values)) {
      return {
        isValid: false,
        errors: ['Значения должны быть массивом'],
      };
    }

    const result = await this.attributeService.validateAttributeValues(input.attributeId, input.values);

    return result;
  }

  /**
   * Получить статистику атрибутов
   */
  async getAttributeStats(): Promise<AttributeStatsDTO> {
    const stats = await this.attributeService.getAttributeStats();
    return new AttributeStatsDTO(stats);
  }

  /**
   * Валидация входных данных для получения атрибутов категории
   */
  private validateCategoryAttributesInput(input: GetCategoryAttributesInput): string[] {
    const errors: string[] = [];

    if (input.categoryId <= 0) {
      errors.push('ID категории должен быть положительным числом');
    }

    if (input.typeId <= 0) {
      errors.push('ID типа товара должен быть положительным числом');
    }

    return errors;
  }

  /**
   * Валидация входных данных для поиска атрибутов
   */
  private validateSearchAttributesInput(input: SearchAttributesInput): string[] {
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

    if (input.categoryId && input.categoryId <= 0) {
      errors.push('ID категории должен быть положительным числом');
    }

    if (input.typeId && input.typeId <= 0) {
      errors.push('ID типа товара должен быть положительным числом');
    }

    return errors;
  }

  /**
   * Валидация входных данных для поиска значений словаря
   */
  private validateSearchDictionaryValuesInput(input: SearchDictionaryValuesInput): string[] {
    const errors: string[] = [];

    if (input.dictionaryId <= 0) {
      errors.push('ID словаря должен быть положительным числом');
    }

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
