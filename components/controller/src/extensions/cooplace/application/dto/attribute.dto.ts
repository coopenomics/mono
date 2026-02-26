import { ObjectType, Field, Int, registerEnumType } from '@nestjs/graphql';
import type { AttributeDomainEntity } from '../../domain/entities/attribute-domain.entity';
import type { DictionaryDomainEntity } from '../../domain/entities/dictionary-domain.entity';
import type { DictionaryValueDomainEntity } from '../../domain/entities/dictionary-value-domain.entity';

/**
 * Enum для типов атрибутов
 */
export enum AttributeType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  URL = 'url',
}

registerEnumType(AttributeType, {
  name: 'MarketplaceAttributeType',
  description: 'Тип атрибута товара',
});

/**
 * GraphQL DTO для значения словаря
 */
@ObjectType('MarketplaceDictionaryValue')
export class DictionaryValueDTO {
  @Field(() => Int, { description: 'ID значения словаря' })
  dictionaryValueId!: number;

  @Field({ description: 'Значение' })
  value!: string;

  @Field({ description: 'Дополнительная информация', nullable: true })
  info?: string;

  @Field({ description: 'URL изображения', nullable: true })
  picture?: string;

  @Field(() => Int, { description: 'ID словаря' })
  dictionaryId!: number;

  @Field({ description: 'Есть ли изображение' })
  hasPicture!: boolean;

  @Field({ description: 'Есть ли дополнительная информация' })
  hasInfo!: boolean;

  @Field({ description: 'Полное описание значения' })
  fullDescription!: string;

  constructor(data: {
    dictionaryValueId: number;
    value: string;
    info?: string;
    picture?: string;
    dictionaryId: number;
    hasPicture: boolean;
    hasInfo: boolean;
    fullDescription: string;
  }) {
    this.dictionaryValueId = data.dictionaryValueId;
    this.value = data.value;
    this.info = data.info;
    this.picture = data.picture;
    this.dictionaryId = data.dictionaryId;
    this.hasPicture = data.hasPicture;
    this.hasInfo = data.hasInfo;
    this.fullDescription = data.fullDescription;
  }

  static fromDomain(entity: DictionaryValueDomainEntity): DictionaryValueDTO {
    return new DictionaryValueDTO({
      dictionaryValueId: entity.dictionaryValueId,
      value: entity.value,
      info: entity.info,
      picture: entity.picture,
      dictionaryId: entity.dictionaryId,
      hasPicture: entity.hasPicture(),
      hasInfo: entity.hasInfo(),
      fullDescription: entity.getFullDescription(),
    });
  }
}

/**
 * GraphQL DTO для словаря
 */
@ObjectType('MarketplaceDictionary')
export class DictionaryDTO {
  @Field(() => Int, { description: 'ID словаря' })
  dictionaryId!: number;

  @Field({ description: 'Название словаря', nullable: true })
  name?: string;

  @Field({ description: 'Описание словаря', nullable: true })
  description?: string;

  @Field(() => [DictionaryValueDTO], { description: 'Значения словаря' })
  values!: DictionaryValueDTO[];

  @Field(() => Int, { description: 'Количество значений' })
  valuesCount!: number;

  @Field({ description: 'Есть ли значения с изображениями' })
  hasValuesWithPictures!: boolean;

  constructor(data: {
    dictionaryId: number;
    name?: string;
    description?: string;
    values: DictionaryValueDTO[];
    valuesCount: number;
    hasValuesWithPictures: boolean;
  }) {
    this.dictionaryId = data.dictionaryId;
    this.name = data.name;
    this.description = data.description;
    this.values = data.values;
    this.valuesCount = data.valuesCount;
    this.hasValuesWithPictures = data.hasValuesWithPictures;
  }

  static fromDomain(entity: DictionaryDomainEntity, includeValues = true): DictionaryDTO {
    return new DictionaryDTO({
      dictionaryId: entity.dictionaryId,
      name: entity.name,
      description: entity.description,
      values: includeValues ? entity.values.map((value) => DictionaryValueDTO.fromDomain(value)) : [],
      valuesCount: entity.getValuesCount(),
      hasValuesWithPictures: entity.hasValuesWithPictures(),
    });
  }
}

/**
 * GraphQL DTO для группы атрибутов
 */
@ObjectType('MarketplaceAttributeGroup')
export class AttributeGroupDTO {
  @Field(() => Int, { description: 'ID группы', nullable: true })
  groupId?: number;

  @Field({ description: 'Название группы' })
  groupName!: string;

  @Field(() => [AttributeDTO], { description: 'Атрибуты в группе' })
  attributes!: AttributeDTO[];

  @Field(() => Int, { description: 'Количество атрибутов в группе' })
  attributesCount!: number;

  constructor(data: { groupId?: number; groupName: string; attributes: AttributeDTO[] }) {
    this.groupId = data.groupId;
    this.groupName = data.groupName;
    this.attributes = data.attributes;
    this.attributesCount = data.attributes.length;
  }
}

/**
 * GraphQL DTO для атрибута товара
 */
@ObjectType('MarketplaceAttribute')
export class AttributeDTO {
  @Field(() => Int, { description: 'ID атрибута' })
  attributeId!: number;

  @Field({ description: 'Название атрибута' })
  name!: string;

  @Field({ description: 'Описание атрибута', nullable: true })
  description?: string;

  @Field(() => AttributeType, { description: 'Тип атрибута' })
  type!: AttributeType;

  @Field({ description: 'Является ли атрибут коллекцией' })
  isCollection!: boolean;

  @Field({ description: 'Является ли атрибут обязательным' })
  isRequired!: boolean;

  @Field({ description: 'Является ли атрибут аспектным' })
  isAspect!: boolean;

  @Field(() => Int, { description: 'Максимальное количество значений' })
  maxValueCount!: number;

  @Field({ description: 'Название группы', nullable: true })
  groupName?: string;

  @Field(() => Int, { description: 'ID группы', nullable: true })
  groupId?: number;

  @Field(() => Int, { description: 'ID словаря', nullable: true })
  dictionaryId?: number;

  @Field({ description: 'Зависит ли от категории' })
  categoryDependent!: boolean;

  @Field({ description: 'Комплексная коллекция' })
  complexIsCollection!: boolean;

  @Field(() => Int, { description: 'ID комплексного атрибута' })
  attributeComplexId!: number;

  @Field(() => DictionaryDTO, { description: 'Словарь значений', nullable: true })
  dictionary?: DictionaryDTO;

  @Field({ description: 'Имеет ли словарь' })
  hasDictionary!: boolean;

  @Field({ description: 'Можно ли изменить после создания товара' })
  canBeModifiedAfterCreation!: boolean;

  @Field(() => Int, { description: 'Максимальное количество значений (вычисленное)' })
  maxValues!: number;

  @Field({ description: 'Является ли комплексным атрибутом' })
  isComplexAttribute!: boolean;

  constructor(data: {
    attributeId: number;
    name: string;
    description?: string;
    type: AttributeType;
    isCollection: boolean;
    isRequired: boolean;
    isAspect: boolean;
    maxValueCount: number;
    groupName?: string;
    groupId?: number;
    dictionaryId?: number;
    categoryDependent: boolean;
    complexIsCollection: boolean;
    attributeComplexId: number;
    dictionary?: DictionaryDTO;
    hasDictionary: boolean;
    canBeModifiedAfterCreation: boolean;
    maxValues: number;
    isComplexAttribute: boolean;
  }) {
    this.attributeId = data.attributeId;
    this.name = data.name;
    this.description = data.description;
    this.type = data.type;
    this.isCollection = data.isCollection;
    this.isRequired = data.isRequired;
    this.isAspect = data.isAspect;
    this.maxValueCount = data.maxValueCount;
    this.groupName = data.groupName;
    this.groupId = data.groupId;
    this.dictionaryId = data.dictionaryId;
    this.categoryDependent = data.categoryDependent;
    this.complexIsCollection = data.complexIsCollection;
    this.attributeComplexId = data.attributeComplexId;
    this.dictionary = data.dictionary;
    this.hasDictionary = data.hasDictionary;
    this.canBeModifiedAfterCreation = data.canBeModifiedAfterCreation;
    this.maxValues = data.maxValues;
    this.isComplexAttribute = data.isComplexAttribute;
  }

  static fromDomain(entity: AttributeDomainEntity, includeDictionary = true): AttributeDTO {
    return new AttributeDTO({
      attributeId: entity.attributeId,
      name: entity.name,
      description: entity.description,
      type: entity.type as AttributeType,
      isCollection: entity.isCollection,
      isRequired: entity.isRequired,
      isAspect: entity.isAspect,
      maxValueCount: entity.maxValueCount,
      groupName: entity.groupName,
      groupId: entity.groupId,
      dictionaryId: entity.dictionaryId,
      categoryDependent: entity.categoryDependent,
      complexIsCollection: entity.complexIsCollection,
      attributeComplexId: entity.attributeComplexId,
      dictionary: includeDictionary && entity.dictionary ? DictionaryDTO.fromDomain(entity.dictionary) : undefined,
      hasDictionary: entity.hasDictionary(),
      canBeModifiedAfterCreation: entity.canBeModifiedAfterCreation(),
      maxValues: entity.getMaxValues(),
      isComplexAttribute: entity.isComplexAttribute(),
    });
  }
}

/**
 * GraphQL DTO для статистики атрибутов
 */
@ObjectType('MarketplaceAttributeStats')
export class AttributeStatsDTO {
  @Field(() => Int, { description: 'Общее количество атрибутов' })
  totalAttributes!: number;

  @Field(() => Int, { description: 'Количество обязательных атрибутов' })
  requiredAttributes!: number;

  @Field(() => Int, { description: 'Количество аспектных атрибутов' })
  aspectAttributes!: number;

  @Field(() => Int, { description: 'Количество словарных атрибутов' })
  dictionaryAttributes!: number;

  @Field(() => Int, { description: 'Общее количество словарей' })
  totalDictionaries!: number;

  @Field(() => Int, { description: 'Общее количество значений словарей' })
  totalDictionaryValues!: number;

  constructor(data: {
    totalAttributes: number;
    requiredAttributes: number;
    aspectAttributes: number;
    dictionaryAttributes: number;
    totalDictionaries: number;
    totalDictionaryValues: number;
  }) {
    this.totalAttributes = data.totalAttributes;
    this.requiredAttributes = data.requiredAttributes;
    this.aspectAttributes = data.aspectAttributes;
    this.dictionaryAttributes = data.dictionaryAttributes;
    this.totalDictionaries = data.totalDictionaries;
    this.totalDictionaryValues = data.totalDictionaryValues;
  }
}
