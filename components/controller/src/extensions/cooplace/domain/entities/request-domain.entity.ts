import type { CategoryDomainEntity } from './category-domain.entity';
import type { TypeDomainEntity } from './type-domain.entity';
import type { RequestAttributeValueDomainEntity } from './request-attribute-value-domain.entity';
import type { RequestImageDomainEntity } from './request-image-domain.entity';

/**
 * Типы заявок (соответствует смарт-контракту)
 */
export enum RequestType {
  OFFER = 'offer', // Предложение на поставку (имущественный паевый взнос)
  ORDER = 'order', // Заказ на поставку (денежный паевый взнос)
}

/**
 * Статусы заявок (соответствует смарт-контракту)
 */
export enum RequestStatus {
  DRAFT = 'draft', // Черновик (локальный статус)
  MODERATION = 'moderation', // На модерации
  PUBLISHED = 'published', // Опубликована
  ACTIVE = 'active', // Активная (локальный статус)
  MATCHED = 'matched', // Сопоставлена (локальный статус)
  AUTHORIZED = 'authorized', // Авторизована
  SUPPLIED1 = 'supplied1', // Поставщик передал товар
  SUPPLIED2 = 'supplied2', // Подтверждена передача
  DELIVERED = 'delivered', // Доставлена
  RECEIVED1 = 'received1', // Заказчик получил товар
  RECEIVED2 = 'received2', // Подтверждено получение
  COMPLETED = 'completed', // Завершена
  CANCELLED = 'cancelled', // Отменена
  DECLINED = 'declined', // Отклонена
  DISPUTED = 'disputed', // Спор
}

/**
 * Уровень заявки в иерархии
 */
export enum RequestLevel {
  PARENT = 'parent', // Родительская заявка (parent_id == 0)
  CHILD = 'child', // Дочерняя заявка (parent_id > 0)
}

/**
 * Доменная сущность заявки для marketplace расширения
 * Представляет заявку на поставку или заказ товара в кооперативе
 * Соответствует таблице exchange в смарт-контракте
 */
export class RequestDomainEntity {
  public readonly id?: number;
  public readonly hash: string;
  public readonly blockchainId: string; // ID блокчейна где находится заявка

  // Иерархия заявок (соответствует смарт-контракту)
  public readonly parentId?: number; // parent_id из смарт-контракта (0 для родительских)
  public readonly parentHash?: string; // Хэш родительской заявки
  public readonly parentUsername?: string; // parent_username из смарт-контракта
  public readonly level: RequestLevel; // Вычисляется на основе parentId

  // Основная информация (соответствует смарт-контракту)
  public readonly coopname: string;
  public readonly username: string;
  public readonly type: RequestType;
  public readonly status: RequestStatus;
  public readonly programId: number; // program_id из смарт-контракта

  // Информация о товаре
  public readonly name: string;
  public readonly articleNumber: string; // артикул
  public readonly barcode?: string; // штрихкод

  // Категория и тип
  public readonly descriptionCategoryId: number;
  public readonly typeId: number;
  public readonly category: CategoryDomainEntity;
  public readonly productType: TypeDomainEntity;

  // Финансовая информация (соответствует смарт-контракту)
  public readonly unitCost: number; // unit_cost из смарт-контракта
  public readonly price: number; // Дублирует unitCost для совместимости
  public readonly oldPrice?: number;
  public readonly currencyCode: string;
  public readonly vat: string;

  // Суммы из смарт-контракта
  public readonly supplierAmount: number; // supplier_amount
  public readonly membershipFee: number; // membership_fee
  public readonly totalCost: number; // total_cost
  public readonly cancellationFee?: number; // cancellation_fee (0-100)
  public readonly cancellationFeeAmount?: number; // cancellation_fee_amount

  // Габариты и вес
  public readonly width?: number;
  public readonly height?: number;
  public readonly depth?: number;
  public readonly dimensionUnit?: string;
  public readonly weight?: number;
  public readonly weightUnit?: string;

  // Количества (соответствует смарт-контракту)
  public readonly units: number; // Общее количество единиц
  public readonly remainUnits: number; // remain_units
  public readonly blockedUnits: number; // blocked_units
  public readonly deliveredUnits: number; // delivered_units
  public readonly availableUnits: number; // Вычисляется: remainUnits
  public readonly settledUnits: number; // Вычисляется: blockedUnits + deliveredUnits

  // Время жизни и гарантии (соответствует смарт-контракту)
  public readonly productLifecycleSecs?: number; // product_lifecycle_secs
  public readonly warrantyDays?: number;
  public readonly warrantyDelayUntil?: Date; // warranty_delay_until
  public readonly deadlineForReceipt?: Date; // deadline_for_receipt

  // Гарантийный возврат (соответствует смарт-контракту)
  public readonly isWarrantyReturn: boolean; // is_warranty_return
  public readonly warrantyReturnId?: number; // warranty_return_id

  // Роли участников (соответствует смарт-контракту)
  public readonly productContributor?: string; // product_contributor
  public readonly moneyContributor?: string; // money_contributor

  // Дополнительные данные (соответствует смарт-контракту)
  public readonly data?: string; // data
  public readonly meta?: string; // meta

  // Связанные сущности (локальные)
  public readonly attributes: RequestAttributeValueDomainEntity[];
  public readonly images: RequestImageDomainEntity[];
  public readonly primaryImageUrl?: string;
  public readonly colorImageUrl?: string;

  // Геоограничения (локальные)
  public readonly geoNames: string[];

  // Временные метки (соответствует смарт-контракту)
  public readonly createdAt: Date; // created_at
  public readonly acceptedAt?: Date; // accepted_at
  public readonly suppliedAt?: Date; // supplied_at
  public readonly deliveredAt?: Date; // delivered_at
  public readonly receivedAt?: Date; // received_at
  public readonly completedAt?: Date; // completed_at
  public readonly declinedAt?: Date; // declined_at
  public readonly cancelledAt?: Date; // cancelled_at
  public readonly disputedAt?: Date; // disputed_at
  public readonly updatedAt: Date; // Локальная метка

  constructor(data: {
    id?: number;
    hash: string;
    blockchainId: string;
    parentId?: number;
    parentHash?: string;
    parentUsername?: string;
    coopname: string;
    username: string;
    type: RequestType;
    status: RequestStatus;
    programId: number;
    name: string;
    articleNumber: string;
    barcode?: string;
    descriptionCategoryId: number;
    typeId: number;
    category: CategoryDomainEntity;
    productType: TypeDomainEntity;
    unitCost: number;
    price?: number;
    oldPrice?: number;
    currencyCode: string;
    vat: string;
    supplierAmount: number;
    membershipFee: number;
    totalCost: number;
    cancellationFee?: number;
    cancellationFeeAmount?: number;
    width?: number;
    height?: number;
    depth?: number;
    dimensionUnit?: string;
    weight?: number;
    weightUnit?: string;
    units: number;
    remainUnits?: number;
    blockedUnits?: number;
    deliveredUnits?: number;
    availableUnits?: number;
    settledUnits?: number;
    productLifecycleSecs?: number;
    warrantyDays?: number;
    warrantyDelayUntil?: Date;
    deadlineForReceipt?: Date;
    isWarrantyReturn?: boolean;
    warrantyReturnId?: number;
    productContributor?: string;
    moneyContributor?: string;
    data?: string;
    meta?: string;
    attributes?: RequestAttributeValueDomainEntity[];
    images?: RequestImageDomainEntity[];
    primaryImageUrl?: string;
    colorImageUrl?: string;
    geoNames?: string[];
    createdAt?: Date;
    acceptedAt?: Date;
    suppliedAt?: Date;
    deliveredAt?: Date;
    receivedAt?: Date;
    completedAt?: Date;
    declinedAt?: Date;
    cancelledAt?: Date;
    disputedAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.hash = data.hash;
    this.blockchainId = data.blockchainId;
    this.parentId = data.parentId;
    this.parentHash = data.parentHash;
    this.parentUsername = data.parentUsername;
    this.level = data.parentId && data.parentId > 0 ? RequestLevel.CHILD : RequestLevel.PARENT;
    this.coopname = data.coopname;
    this.username = data.username;
    this.type = data.type;
    this.status = data.status;
    this.programId = data.programId;
    this.name = data.name;
    this.articleNumber = data.articleNumber;
    this.barcode = data.barcode;
    this.descriptionCategoryId = data.descriptionCategoryId;
    this.typeId = data.typeId;
    this.category = data.category;
    this.productType = data.productType;
    this.unitCost = data.unitCost;
    this.price = data.price ?? data.unitCost;
    this.oldPrice = data.oldPrice;
    this.currencyCode = data.currencyCode;
    this.vat = data.vat;
    this.supplierAmount = data.supplierAmount;
    this.membershipFee = data.membershipFee;
    this.totalCost = data.totalCost;
    this.cancellationFee = data.cancellationFee;
    this.cancellationFeeAmount = data.cancellationFeeAmount;
    this.width = data.width;
    this.height = data.height;
    this.depth = data.depth;
    this.dimensionUnit = data.dimensionUnit;
    this.weight = data.weight;
    this.weightUnit = data.weightUnit;
    this.units = data.units;
    this.remainUnits = data.remainUnits ?? data.units;
    this.blockedUnits = data.blockedUnits ?? 0;
    this.deliveredUnits = data.deliveredUnits ?? 0;
    this.availableUnits = data.availableUnits ?? this.remainUnits;
    this.settledUnits = data.settledUnits ?? this.blockedUnits + this.deliveredUnits;
    this.productLifecycleSecs = data.productLifecycleSecs;
    this.warrantyDays = data.warrantyDays;
    this.warrantyDelayUntil = data.warrantyDelayUntil;
    this.deadlineForReceipt = data.deadlineForReceipt;
    this.isWarrantyReturn = data.isWarrantyReturn ?? false;
    this.warrantyReturnId = data.warrantyReturnId;
    this.productContributor = data.productContributor;
    this.moneyContributor = data.moneyContributor;
    this.data = data.data;
    this.meta = data.meta;
    this.attributes = data.attributes || [];
    this.images = data.images || [];
    this.primaryImageUrl = data.primaryImageUrl;
    this.colorImageUrl = data.colorImageUrl;
    this.geoNames = data.geoNames || [];
    this.createdAt = data.createdAt || new Date();
    this.acceptedAt = data.acceptedAt;
    this.suppliedAt = data.suppliedAt;
    this.deliveredAt = data.deliveredAt;
    this.receivedAt = data.receivedAt;
    this.completedAt = data.completedAt;
    this.declinedAt = data.declinedAt;
    this.cancelledAt = data.cancelledAt;
    this.disputedAt = data.disputedAt;
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Проверяет, является ли заявка родительской
   */
  isParent(): boolean {
    return this.level === RequestLevel.PARENT;
  }

  /**
   * Проверяет, является ли заявка дочерней
   */
  isChild(): boolean {
    return this.level === RequestLevel.CHILD;
  }

  /**
   * Проверяет, является ли заявка активной
   */
  isActive(): boolean {
    return this.status === RequestStatus.ACTIVE || this.status === RequestStatus.PUBLISHED;
  }

  /**
   * Проверяет, можно ли редактировать заявку
   */
  canBeEdited(): boolean {
    return [RequestStatus.DRAFT, RequestStatus.MODERATION].includes(this.status);
  }

  /**
   * Проверяет, является ли заявка предложением (имущественный взнос)
   */
  isOffer(): boolean {
    return this.type === RequestType.OFFER;
  }

  /**
   * Проверяет, является ли заявка заказом (денежный взнос)
   */
  isOrder(): boolean {
    return this.type === RequestType.ORDER;
  }

  /**
   * Получает цену как число
   */
  getPriceAsNumber(): number {
    return this.price;
  }

  /**
   * Получает старую цену как число
   */
  getOldPriceAsNumber(): number | null {
    return this.oldPrice || null;
  }

  /**
   * Проверяет наличие скидки
   */
  hasDiscount(): boolean {
    const oldPrice = this.getOldPriceAsNumber();
    const currentPrice = this.getPriceAsNumber();
    return oldPrice !== null && oldPrice > currentPrice;
  }

  /**
   * Вычисляет процент скидки
   */
  getDiscountPercentage(): number {
    if (!this.hasDiscount()) return 0;
    const oldPrice = this.getOldPriceAsNumber();
    const currentPrice = this.getPriceAsNumber();
    if (oldPrice === null || oldPrice === 0) {
      return 0;
    }
    return Math.round(((oldPrice - currentPrice) / oldPrice) * 100);
  }

  /**
   * Проверяет, является ли гарантийным возвратом
   */
  isWarrantyReturnRequest(): boolean {
    return this.isWarrantyReturn;
  }

  /**
   * Проверяет, можно ли отменить заявку
   */
  canBeCancelled(): boolean {
    return ![RequestStatus.COMPLETED, RequestStatus.CANCELLED, RequestStatus.DECLINED].includes(this.status);
  }

  /**
   * Получает общую стоимость
   */
  getTotalValue(): number {
    return this.unitCost * this.units;
  }

  /**
   * Получает процент выполнения заявки
   */
  getCompletionPercentage(): number {
    if (this.units === 0) return 0;
    return Math.round((this.deliveredUnits / this.units) * 100);
  }

  /**
   * Получает обязательные атрибуты
   */
  getRequiredAttributes(): RequestAttributeValueDomainEntity[] {
    return this.attributes.filter((attr) => attr.attribute.isRequired);
  }

  /**
   * Получает аспектные атрибуты
   */
  getAspectAttributes(): RequestAttributeValueDomainEntity[] {
    return this.attributes.filter((attr) => attr.attribute.isAspect);
  }

  /**
   * Проверяет, заполнены ли все обязательные атрибуты
   */
  hasAllRequiredAttributes(): boolean {
    const requiredAttributeIds = this.productType.getRequiredAttributes().map((cta) => cta.attribute.attributeId);
    const filledAttributeIds = this.attributes.map((attr) => attr.attribute.attributeId);
    return requiredAttributeIds.every((id) => filledAttributeIds.includes(id));
  }

  /**
   * Проверяет валидность заявки для публикации
   */
  isValidForPublication(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Проверка основных полей
    if (!this.name.trim()) errors.push('Название товара обязательно');
    if (!this.articleNumber.trim()) errors.push('Артикул обязателен');
    if (this.unitCost <= 0) errors.push('Цена должна быть больше 0');
    if (this.units <= 0) errors.push('Количество должно быть больше 0');

    // Проверка специфичных для типа заявки полей
    if (this.isParent() && this.type === RequestType.OFFER) {
      if (!this.productLifecycleSecs || this.productLifecycleSecs <= 0) {
        errors.push('Гарантийный срок возврата для имущества должен быть установлен');
      }
    }

    // Проверка габаритов
    if (!this.width || !this.height || !this.depth) {
      errors.push('Габариты товара обязательны');
    }
    if (!this.weight) {
      errors.push('Вес товара обязателен');
    }

    // Проверка категории и типа
    if (this.category.disabled) {
      errors.push('Выбранная категория недоступна');
    }
    if (this.productType.disabled) {
      errors.push('Выбранный тип товара недоступен');
    }

    // Проверка обязательных атрибутов
    if (!this.hasAllRequiredAttributes()) {
      errors.push('Не заполнены все обязательные характеристики');
    }

    // Проверка изображений
    if (this.images.length === 0 && !this.primaryImageUrl) {
      errors.push('Необходимо добавить хотя бы одно изображение');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
