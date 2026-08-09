import type { CategoryDomainEntity } from './category-domain.entity';
import type { CategoryTypeAttributeDomainEntity } from './category-type-attribute-domain.entity';

/**
 * Доменная сущность типа товара для marketplace расширения
 * Представляет конкретный тип товара внутри категории из Ozon API
 */
export class TypeDomainEntity {
  public readonly typeId: number;
  public readonly typeName: string;
  public readonly disabled: boolean;
  public readonly descriptionCategoryId: number;
  public readonly category: CategoryDomainEntity;
  public readonly categoryTypeAttributes: CategoryTypeAttributeDomainEntity[];
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(data: {
    typeId: number;
    typeName: string;
    disabled: boolean;
    descriptionCategoryId: number;
    category: CategoryDomainEntity;
    categoryTypeAttributes?: CategoryTypeAttributeDomainEntity[];
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.typeId = data.typeId;
    this.typeName = data.typeName;
    this.disabled = data.disabled;
    this.descriptionCategoryId = data.descriptionCategoryId;
    this.category = data.category;
    this.categoryTypeAttributes = data.categoryTypeAttributes || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Проверяет, доступен ли тип для создания товаров
   */
  isAvailable(): boolean {
    return !this.disabled && !this.category.disabled;
  }

  /**
   * Получает полное название с категорией
   */
  getFullName(): string {
    return `${this.category.categoryName} / ${this.typeName}`;
  }

  /**
   * Получает все атрибуты для данного типа
   */
  getAttributes(): CategoryTypeAttributeDomainEntity[] {
    return this.categoryTypeAttributes;
  }

  /**
   * Получает обязательные атрибуты
   */
  getRequiredAttributes(): CategoryTypeAttributeDomainEntity[] {
    return this.categoryTypeAttributes.filter((cta) => cta.attribute.isRequired);
  }
}
