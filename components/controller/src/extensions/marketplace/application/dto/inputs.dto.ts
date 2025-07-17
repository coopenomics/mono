import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';

/**
 * Input для получения дерева категорий
 */
@InputType()
export class GetCategoryTreeInput {
  @Field(() => Int, { description: 'ID корневой категории', nullable: true })
  @IsOptional()
  @IsNumber()
  rootCategoryId?: number;

  @Field({ description: 'Включать только доступные категории', nullable: true, defaultValue: false })
  @IsOptional()
  onlyAvailable?: boolean;

  @Field({ description: 'Включать типы товаров', nullable: true, defaultValue: true })
  @IsOptional()
  includeTypes?: boolean;

  @Field(() => Int, { description: 'Максимальная глубина дерева', nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxDepth?: number;
}

/**
 * Input для поиска категорий
 */
@InputType()
export class SearchCategoriesInput {
  @Field({ description: 'Текст для поиска' })
  @IsString()
  searchTerm!: string;

  @Field({ description: 'Только доступные категории', nullable: true, defaultValue: false })
  @IsOptional()
  onlyAvailable?: boolean;

  @Field(() => Int, { description: 'Максимальное количество результатов', nullable: true, defaultValue: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

/**
 * Input для получения атрибутов категории и типа
 */
@InputType()
export class GetCategoryAttributesInput {
  @Field(() => Int, { description: 'ID категории' })
  @IsNumber()
  categoryId!: number;

  @Field(() => Int, { description: 'ID типа товара' })
  @IsNumber()
  typeId!: number;

  @Field({ description: 'Включать значения словарей', nullable: true, defaultValue: true })
  @IsOptional()
  includeDictionaryValues?: boolean;

  @Field({ description: 'Группировать атрибуты', nullable: true, defaultValue: false })
  @IsOptional()
  groupAttributes?: boolean;

  @Field({ description: 'Только обязательные атрибуты', nullable: true, defaultValue: false })
  @IsOptional()
  onlyRequired?: boolean;
}

/**
 * Input для поиска атрибутов
 */
@InputType()
export class SearchAttributesInput {
  @Field({ description: 'Текст для поиска' })
  @IsString()
  searchTerm!: string;

  @Field(() => Int, { description: 'ID категории для фильтрации', nullable: true })
  @IsOptional()
  @IsNumber()
  categoryId?: number;

  @Field(() => Int, { description: 'ID типа товара для фильтрации', nullable: true })
  @IsOptional()
  @IsNumber()
  typeId?: number;

  @Field({ description: 'Только обязательные', nullable: true, defaultValue: false })
  @IsOptional()
  onlyRequired?: boolean;

  @Field({ description: 'Только аспектные', nullable: true, defaultValue: false })
  @IsOptional()
  onlyAspect?: boolean;

  @Field({ description: 'Только со словарями', nullable: true, defaultValue: false })
  @IsOptional()
  onlyWithDictionary?: boolean;

  @Field(() => Int, { description: 'Максимальное количество результатов', nullable: true, defaultValue: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

/**
 * Input для поиска значений словаря
 */
@InputType()
export class SearchDictionaryValuesInput {
  @Field(() => Int, { description: 'ID словаря' })
  @IsNumber()
  dictionaryId!: number;

  @Field({ description: 'Текст для поиска' })
  @IsString()
  searchTerm!: string;

  @Field(() => Int, { description: 'Максимальное количество результатов', nullable: true, defaultValue: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

/**
 * Input для валидации значений атрибута
 */
@InputType()
export class ValidateAttributeValuesInput {
  @Field(() => Int, { description: 'ID атрибута' })
  @IsNumber()
  attributeId!: number;

  @Field(() => [String], { description: 'Значения для валидации' })
  values!: string[];
}

/**
 * Input для получения листовых категорий
 */
@InputType()
export class GetLeafCategoriesInput {
  @Field(() => Int, { description: 'ID родительской категории', nullable: true })
  @IsOptional()
  @IsNumber()
  parentCategoryId?: number;

  @Field({ description: 'Только доступные категории', nullable: true, defaultValue: true })
  @IsOptional()
  onlyAvailable?: boolean;
}
