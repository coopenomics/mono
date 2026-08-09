import { Resolver, Query, Args } from '@nestjs/graphql';
import { Injectable, UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '@coopenomics/extension-kit';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { AttributeDomainService } from '../../domain/services/attribute-domain.service';
import { AttributeDTO, AttributeGroupDTO, AttributeStatsDTO, DictionaryValueDTO } from '../dto/attribute.dto';
import { SearchAttributesInput } from '../dto/search-attributes-input.dto';
import { GetCategoryAttributesInput } from '../dto/get-category-attributes-input.dto';
import { SearchDictionaryValuesInput } from '../dto/search-dictionary-values-input.dto';
import { ValidateAttributeValuesInput } from '../dto/validate-attribute-values-input.dto';
import { GetRequiredAttributesInput } from '../dto/get-required-attributes-input.dto';

/**
 * Результат валидации атрибута
 */
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType('MarketplaceAttributeValidation')
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
 * GraphQL резолвер для атрибутов marketplace.
 *
 * Доступ — пайщикам кооператива (через `MarketplaceMembershipGuard`).
 * Story 1.3 / 1.8: словарь атрибутов — закрытый ресурс marketplace.
 */
@Resolver(() => AttributeDTO)
@UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
@Injectable()
export class AttributeResolver {
  constructor(private readonly attributeService: AttributeDomainService) {}

  /**
   * Получить атрибуты для категории и типа товара
   */
  @Query(() => [AttributeDTO], {
    name: 'marketplaceCategoryAttributes',
    description: 'Получить атрибуты для конкретной категории и типа товара marketplace',
  })
  async getCategoryAttributes(
    @Args('input', { type: () => GetCategoryAttributesInput })
    input: GetCategoryAttributesInput
  ): Promise<AttributeDTO[]> {
    const result = await this.attributeService.getAttributesForCategoryTypeWithFilters({
      categoryId: input.categoryId,
      typeId: input.typeId,
      includeDictionaryValues: input.includeDictionaryValues,
      onlyRequired: input.onlyRequired,
    });

    return result.attributes.map((attr) => AttributeDTO.fromDomain(attr, input.includeDictionaryValues));
  }

  /**
   * Получить группированные атрибуты для категории и типа товара
   */
  @Query(() => [AttributeGroupDTO], {
    name: 'marketplaceCategoryAttributesGrouped',
    description: 'Получить группированные атрибуты для категории и типа товара marketplace',
  })
  async getCategoryAttributesGrouped(
    @Args('input', { type: () => GetCategoryAttributesInput })
    input: GetCategoryAttributesInput
  ): Promise<AttributeGroupDTO[]> {
    // Получаем отфильтрованные атрибуты через доменный сервис
    const result = await this.attributeService.getAttributesForCategoryTypeWithFilters({
      categoryId: input.categoryId,
      typeId: input.typeId,
      includeDictionaryValues: input.includeDictionaryValues,
      onlyRequired: input.onlyRequired,
    });

    // Группируем атрибуты
    const groupedAttributes = new Map<string, typeof result.attributes>();
    for (const attribute of result.attributes) {
      const groupName = attribute.groupName || 'Без группы';
      if (!groupedAttributes.has(groupName)) {
        groupedAttributes.set(groupName, []);
      }
      groupedAttributes.get(groupName)?.push(attribute);
    }

    // Преобразуем в DTO
    const resultGroups: AttributeGroupDTO[] = [];
    for (const [groupName, attributes] of groupedAttributes.entries()) {
      if (attributes.length > 0) {
        const groupId = attributes[0].groupId;
        resultGroups.push(
          new AttributeGroupDTO({
            groupId,
            groupName,
            attributes: attributes.map((attr) => AttributeDTO.fromDomain(attr, input.includeDictionaryValues)),
          })
        );
      }
    }

    return resultGroups;
  }

  /**
   * Получить обязательные атрибуты для категории и типа
   */
  @Query(() => [AttributeDTO], {
    name: 'marketplaceRequiredAttributes',
    description: 'Получить обязательные атрибуты для категории и типа товара marketplace',
  })
  async getRequiredAttributes(
    @Args('data', { type: () => GetRequiredAttributesInput })
    data: GetRequiredAttributesInput
  ): Promise<AttributeDTO[]> {
    const attributes = await this.attributeService.getRequiredAttributes(data.categoryId, data.typeId);
    return attributes.map((attr) => AttributeDTO.fromDomain(attr));
  }

  /**
   * Получить аспектные атрибуты для категории и типа
   */
  @Query(() => [AttributeDTO], {
    name: 'marketplaceAspectAttributes',
    description: 'Получить аспектные атрибуты для категории и типа товара marketplace',
  })
  async getAspectAttributes(
    @Args('data', { type: () => GetRequiredAttributesInput })
    data: GetRequiredAttributesInput
  ): Promise<AttributeDTO[]> {
    const attributes = await this.attributeService.getAspectAttributes(data.categoryId, data.typeId);
    return attributes.map((attr) => AttributeDTO.fromDomain(attr));
  }

  /**
   * Поиск атрибутов
   */
  @Query(() => [AttributeDTO], {
    name: 'marketplaceSearchAttributes',
    description: 'Поиск атрибутов marketplace по названию',
  })
  async searchAttributes(
    @Args('input', { type: () => SearchAttributesInput })
    input: SearchAttributesInput
  ): Promise<AttributeDTO[]> {
    const attributes = await this.attributeService.searchAttributesWithFilters({
      searchTerm: input.searchTerm,
      categoryId: input.categoryId,
      typeId: input.typeId,
      onlyRequired: input.onlyRequired,
      onlyAspect: input.onlyAspect,
      onlyWithDictionary: input.onlyWithDictionary,
      limit: input.limit,
    });

    return attributes.map((attr) => AttributeDTO.fromDomain(attr));
  }

  /**
   * Поиск значений словаря
   */
  @Query(() => [DictionaryValueDTO], {
    name: 'marketplaceSearchDictionaryValues',
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
    name: 'marketplaceValidateAttributeValues',
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
    name: 'marketplaceAttributeStats',
    description: 'Получить статистику по атрибутам marketplace',
  })
  async getAttributeStats(): Promise<AttributeStatsDTO> {
    const stats = await this.attributeService.getAttributeStats();
    return new AttributeStatsDTO(stats);
  }
}
