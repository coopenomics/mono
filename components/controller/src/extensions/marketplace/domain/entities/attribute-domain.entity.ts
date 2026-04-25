import type { DictionaryDomainEntity } from './dictionary-domain.entity';
import type { CategoryTypeAttributeDomainEntity } from './category-type-attribute-domain.entity';

/**
 * Доменная сущность атрибута товара для marketplace расширения
 * Представляет характеристики товаров для конкретных категорий и типов товаров
 */
export class AttributeDomainEntity {
  public readonly attributeId: number;
  public readonly name: string;
  public readonly description?: string;
  public readonly type: string;
  public readonly isCollection: boolean;
  public readonly isRequired: boolean;
  public readonly isAspect: boolean;
  public readonly maxValueCount: number;
  public readonly groupName?: string;
  public readonly groupId?: number;
  public readonly dictionaryId?: number;
  public readonly categoryDependent: boolean;
  public readonly complexIsCollection: boolean;
  public readonly attributeComplexId: number;
  public readonly dictionary?: DictionaryDomainEntity;
  public readonly categoryTypeAttributes: CategoryTypeAttributeDomainEntity[];
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(data: {
    attributeId: number;
    name: string;
    description?: string;
    type: string;
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
    dictionary?: DictionaryDomainEntity;
    categoryTypeAttributes?: CategoryTypeAttributeDomainEntity[];
    createdAt?: Date;
    updatedAt?: Date;
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
    this.categoryTypeAttributes = data.categoryTypeAttributes || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Проверяет, является ли атрибут словарным
   */
  hasDictionary(): boolean {
    return this.dictionaryId !== undefined && this.dictionaryId > 0;
  }

  /**
   * Проверяет, можно ли изменить атрибут после создания товара
   */
  canBeModifiedAfterCreation(): boolean {
    return !this.isAspect;
  }

  /**
   * Получает максимальное количество значений
   */
  getMaxValues(): number {
    if (this.isCollection) {
      return this.maxValueCount > 0 ? this.maxValueCount : Number.MAX_SAFE_INTEGER;
    }
    return 1;
  }

  /**
   * Получает группу атрибута
   */
  getGroup(): { id?: number; name?: string } {
    return {
      id: this.groupId,
      name: this.groupName,
    };
  }

  /**
   * Проверяет, является ли атрибут комплексным
   */
  isComplexAttribute(): boolean {
    return this.attributeComplexId > 0;
  }
}
