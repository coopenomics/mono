import type { TypeDomainEntity } from './type-domain.entity';

/**
 * Доменная сущность категории для marketplace расширения
 * Представляет иерархическую структуру категорий из Ozon API
 */
export class CategoryDomainEntity {
  public readonly descriptionCategoryId: number;
  public readonly categoryName: string;
  public readonly disabled: boolean;
  public readonly parentId?: number;
  public readonly parent?: CategoryDomainEntity;
  public readonly children: CategoryDomainEntity[];
  public readonly types: TypeDomainEntity[];
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(data: {
    descriptionCategoryId: number;
    categoryName: string;
    disabled: boolean;
    parentId?: number;
    parent?: CategoryDomainEntity;
    children?: CategoryDomainEntity[];
    types?: TypeDomainEntity[];
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.descriptionCategoryId = data.descriptionCategoryId;
    this.categoryName = data.categoryName;
    this.disabled = data.disabled;
    this.parentId = data.parentId;
    this.parent = data.parent;
    this.children = data.children || [];
    this.types = data.types || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Проверяет, является ли категория листовой (может содержать товары)
   */
  isLeafCategory(): boolean {
    return this.children.length === 0 && !this.disabled;
  }

  /**
   * Получает полный путь к категории
   */
  getFullPath(): string {
    if (!this.parent) {
      return this.categoryName;
    }
    return `${this.parent.getFullPath()} / ${this.categoryName}`;
  }

  /**
   * Получает все дочерние категории рекурсивно
   */
  getAllDescendants(): CategoryDomainEntity[] {
    const descendants: CategoryDomainEntity[] = [];

    for (const child of this.children) {
      descendants.push(child);
      descendants.push(...child.getAllDescendants());
    }

    return descendants;
  }
}
