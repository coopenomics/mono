import { Resolver, Query, Args } from '@nestjs/graphql';
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
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType('MarketplaceAttributeValidationResult')
export class AttributeValidationResult {
  @Field({ description: 'Результат валидации' })
  isValid!: boolean;

  @Field(() => [String], { description: 'Список ошибок' })
  errors!: string[];

  constructor(data: { isValid: boolean; errors: string[] }) {
    this.isValid = data.isValid;
    this.errors = data.errors;
  }
}

/**
 * GraphQL резолвер для атрибутов marketplace
 */
@Resolver(() => AttributeDTO)
@Injectable()
export class AttributeResolver {
  constructor(private readonly attributeService: AttributeDomainService) {}

  /**
   * Получить атрибуты для категории и типа товара
   */
  @Query(() => [AttributeDTO], {
    name: 'getMarketplaceCategoryAttributes',
    description: 'Получить атрибуты для конкретной категории и типа товара marketplace',
  })
  async getCategoryAttributes(
    @Args('input', { type: () => GetCategoryAttributesInput })
    input: GetCategoryAttributesInput
  ): Promise<AttributeDTO[]> {
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
   * Получить группированные атрибуты для категории и типа товара
   */
  @Query(() => [AttributeGroupDTO], {
    name: 'getMarketplaceCategoryAttributesGrouped',
    description: 'Получить группированные атрибуты для категории и типа товара marketplace',
  })
  async getCategoryAttributesGrouped(
    @Args('input', { type: () => GetCategoryAttributesInput })
    input: GetCategoryAttributesInput
  ): Promise<AttributeGroupDTO[]> {
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

    return result;
  }

  /**
   * Получить обязательные атрибуты для категории и типа
   */
  @Query(() => [AttributeDTO], {
    name: 'getMarketplaceRequiredAttributes',
    description: 'Получить обязательные атрибуты для категории и типа товара marketplace',
  })
  async getRequiredAttributes(
    @Args('categoryId', { type: () => Number }) categoryId: number,
    @Args('typeId', { type: () => Number }) typeId: number
  ): Promise<AttributeDTO[]> {
    const attributes = await this.attributeService.getRequiredAttributes(categoryId, typeId);
    return attributes.map((attr) => AttributeDTO.fromDomain(attr));
  }

  /**
   * Получить аспектные атрибуты для категории и типа
   */
  @Query(() => [AttributeDTO], {
    name: 'getMarketplaceAspectAttributes',
    description: 'Получить аспектные атрибуты для категории и типа товара marketplace',
  })
  async getAspectAttributes(
    @Args('categoryId', { type: () => Number }) categoryId: number,
    @Args('typeId', { type: () => Number }) typeId: number
  ): Promise<AttributeDTO[]> {
    const attributes = await this.attributeService.getAspectAttributes(categoryId, typeId);
    return attributes.map((attr) => AttributeDTO.fromDomain(attr));
  }

  /**
   * Поиск атрибутов
   */
  @Query(() => [AttributeDTO], {
    name: 'searchMarketplaceAttributes',
    description: 'Поиск атрибутов marketplace по названию',
  })
  async searchAttributes(
    @Args('input', { type: () => SearchAttributesInput })
    input: SearchAttributesInput
  ): Promise<AttributeDTO[]> {
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
  @Query(() => [DictionaryValueDTO], {
    name: 'searchMarketplaceDictionaryValues',
    description: 'Поиск значений словаря marketplace',
  })
  async searchDictionaryValues(
    @Args('input', { type: () => SearchDictionaryValuesInput })
    input: SearchDictionaryValuesInput
  ): Promise<DictionaryValueDTO[]> {
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
  @Query(() => AttributeValidationResult, {
    name: 'validateMarketplaceAttributeValues',
    description: 'Валидация значений атрибута marketplace',
  })
  async validateAttributeValues(
    @Args('input', { type: () => ValidateAttributeValuesInput })
    input: ValidateAttributeValuesInput
  ): Promise<AttributeValidationResult> {
    const result = await this.attributeService.validateAttributeValues(input.attributeId, input.values);

    return new AttributeValidationResult(result);
  }

  /**
   * Получить статистику по атрибутам
   */
  @Query(() => AttributeStatsDTO, {
    name: 'getMarketplaceAttributeStats',
    description: 'Получить статистику по атрибутам marketplace',
  })
  async getAttributeStats(): Promise<AttributeStatsDTO> {
    const stats = await this.attributeService.getAttributeStats();
    return new AttributeStatsDTO(stats);
  }
}
