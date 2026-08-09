/**
 * Доменная сущность для управления доступными категориями и типами товаров в кооперативе
 * Определяет какие категории и типы товаров маркетплейса доступны в конкретном кооперативе
 */
export class AvailableCategoryDomainEntity {
  public readonly id: number;
  public readonly coopname: string;
  public readonly categoryId: number;
  public readonly typeId?: number; // null = доступна вся категория, число = только конкретный тип
  public readonly isActive: boolean;
  public readonly addedBy: string;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(data: {
    id?: number;
    coopname: string;
    categoryId: number;
    typeId?: number;
    isActive?: boolean;
    addedBy: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id || 0;
    this.coopname = data.coopname;
    this.categoryId = data.categoryId;
    this.typeId = data.typeId;
    this.isActive = data.isActive ?? true;
    this.addedBy = data.addedBy;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Проверяет, активна ли категория/тип
   */
  isActiveCategory(): boolean {
    return this.isActive;
  }

  /**
   * Проверяет, применяется ли к конкретному типу товара
   */
  isForSpecificType(): boolean {
    return this.typeId !== undefined && this.typeId !== null;
  }

  /**
   * Проверяет, применяется ли к всей категории
   */
  isForEntireCategory(): boolean {
    return this.typeId === undefined || this.typeId === null;
  }

  /**
   * Проверяет, доступен ли указанный тип товара
   */
  isTypeAvailable(typeId: number): boolean {
    if (!this.isActive) return false;

    // Если правило для всей категории - любой тип доступен
    if (this.isForEntireCategory()) {
      return true;
    }

    // Если правило для конкретного типа - проверяем соответствие
    return this.typeId === typeId;
  }

  /**
   * Деактивирует категорию/тип
   */
  deactivate(): AvailableCategoryDomainEntity {
    return new AvailableCategoryDomainEntity({
      ...this,
      isActive: false,
      updatedAt: new Date(),
    });
  }

  /**
   * Активирует категорию/тип
   */
  activate(): AvailableCategoryDomainEntity {
    return new AvailableCategoryDomainEntity({
      ...this,
      isActive: true,
      updatedAt: new Date(),
    });
  }
}
