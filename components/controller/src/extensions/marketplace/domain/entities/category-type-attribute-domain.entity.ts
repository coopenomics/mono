import type { CategoryDomainEntity } from './category-domain.entity';
import type { TypeDomainEntity } from './type-domain.entity';
import type { AttributeDomainEntity } from './attribute-domain.entity';

/**
 * Доменная сущность связи между категориями, типами товаров и их характеристиками
 * Представляет отношение "многие ко многим" между категориями, типами и атрибутами из Ozon API
 */
export class CategoryTypeAttributeDomainEntity {
  public readonly descriptionCategoryId: number;
  public readonly typeId: number;
  public readonly attributeId: number;
  public readonly category: CategoryDomainEntity;
  public readonly type: TypeDomainEntity;
  public readonly attribute: AttributeDomainEntity;
  public readonly categoryName: string;
  public readonly typeName: string;
  public readonly isFetched: boolean;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(data: {
    descriptionCategoryId: number;
    typeId: number;
    attributeId: number;
    category: CategoryDomainEntity;
    type: TypeDomainEntity;
    attribute: AttributeDomainEntity;
    categoryName: string;
    typeName: string;
    isFetched: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.descriptionCategoryId = data.descriptionCategoryId;
    this.typeId = data.typeId;
    this.attributeId = data.attributeId;
    this.category = data.category;
    this.type = data.type;
    this.attribute = data.attribute;
    this.categoryName = data.categoryName;
    this.typeName = data.typeName;
    this.isFetched = data.isFetched;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Получает уникальный идентификатор связи
   */
  getCompositeKey(): string {
    return `${this.descriptionCategoryId}-${this.typeId}-${this.attributeId}`;
  }

  /**
   * Проверяет, является ли атрибут обязательным для данной категории и типа
   */
  isRequired(): boolean {
    return this.attribute.isRequired;
  }

  /**
   * Проверяет, является ли атрибут аспектным
   */
  isAspect(): boolean {
    return this.attribute.isAspect;
  }

  /**
   * Получает полное описание связи
   */
  getDescription(): string {
    return `${this.categoryName} / ${this.typeName} -> ${this.attribute.name}`;
  }

  /**
   * Проверяет, загружены ли данные атрибута
   */
  isDataFetched(): boolean {
    return this.isFetched;
  }

  /**
   * Получает группу атрибута
   */
  getAttributeGroup(): { id?: number; name?: string } {
    return this.attribute.getGroup();
  }
}
