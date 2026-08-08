import { ObjectType, Field, Int, registerEnumType } from '@nestjs/graphql';
import { RequestDomainEntity, RequestType, RequestStatus } from '../../domain/entities/request-domain.entity';
import { RequestAttributeValueDomainEntity } from '../../domain/entities/request-attribute-value-domain.entity';
import { RequestImageDomainEntity, RequestImageType } from '../../domain/entities/request-image-domain.entity';
import { CategoryDTO } from './category-tree.dto';
import { ProductTypeDTO } from './category-tree.dto';
import { AttributeDTO } from './attribute.dto';

// Регистрируем enums для GraphQL
registerEnumType(RequestType, {
  name: 'RequestType',
  description: 'Тип заявки',
});

registerEnumType(RequestStatus, {
  name: 'RequestStatus',
  description: 'Статус заявки',
});

registerEnumType(RequestImageType, {
  name: 'RequestImageType',
  description: 'Тип изображения заявки',
});

/**
 * DTO для значения атрибута заявки
 */
@ObjectType('MarketplaceRequestAttributeValue')
export class RequestAttributeValueDTO {
  @Field(() => Int, { description: 'ID значения атрибута' })
  id!: number;

  @Field(() => Int, { description: 'ID атрибута' })
  attributeId!: number;

  @Field(() => AttributeDTO, { description: 'Информация об атрибуте' })
  attribute!: AttributeDTO;

  @Field(() => Int, { description: 'ID комплексного атрибута' })
  complexId!: number;

  @Field({ description: 'Значение атрибута' })
  value!: string;

  @Field(() => Int, { description: 'ID значения из словаря', nullable: true })
  dictionaryValueId?: number;

  @Field({ description: 'Является ли атрибут обязательным' })
  isRequired!: boolean;

  @Field({ description: 'Является ли атрибут аспектным' })
  isAspect!: boolean;

  @Field({ description: 'Тип атрибута' })
  attributeType!: string;

  @Field({ description: 'Группа атрибута', nullable: true })
  attributeGroup?: string;

  @Field({ description: 'Дата создания' })
  createdAt!: Date;

  constructor(data: {
    id: number;
    attributeId: number;
    attribute: AttributeDTO;
    complexId: number;
    value: string;
    dictionaryValueId?: number;
    isRequired: boolean;
    isAspect: boolean;
    attributeType: string;
    attributeGroup?: string;
    createdAt: Date;
  }) {
    this.id = data.id;
    this.attributeId = data.attributeId;
    this.attribute = data.attribute;
    this.complexId = data.complexId;
    this.value = data.value;
    this.dictionaryValueId = data.dictionaryValueId;
    this.isRequired = data.isRequired;
    this.isAspect = data.isAspect;
    this.attributeType = data.attributeType;
    this.attributeGroup = data.attributeGroup;
    this.createdAt = data.createdAt;
  }

  static fromDomain(entity: RequestAttributeValueDomainEntity): RequestAttributeValueDTO {
    return new RequestAttributeValueDTO({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      id: entity.id!,
      attributeId: entity.attributeId,
      attribute: AttributeDTO.fromDomain(entity.attribute),
      complexId: entity.complexId,
      value: entity.value,
      dictionaryValueId: entity.dictionaryValueId,
      isRequired: entity.isRequired(),
      isAspect: entity.isAspect(),
      attributeType: entity.getAttributeType(),
      attributeGroup: entity.getAttributeGroup(),
      createdAt: entity.createdAt,
    });
  }
}

/**
 * DTO для изображения заявки
 */
@ObjectType('MarketplaceRequestImage')
export class RequestImageDTO {
  @Field(() => Int, { description: 'ID изображения' })
  id!: number;

  @Field({ description: 'URL изображения' })
  imageUrl!: string;

  @Field(() => RequestImageType, { description: 'Тип изображения' })
  imageType!: RequestImageType;

  @Field(() => Int, { description: 'Порядок сортировки' })
  sortOrder!: number;

  @Field({ description: 'Описание изображения', nullable: true })
  description?: string;

  @Field({ description: 'Является ли главным изображением' })
  isPrimary!: boolean;

  @Field({ description: 'Является ли образцом цвета' })
  isColorSample!: boolean;

  @Field({ description: 'Является ли изображением 360°' })
  is360Image!: boolean;

  @Field({ description: 'Описание типа изображения' })
  typeDescription!: string;

  @Field({ description: 'Имя файла' })
  fileName!: string;

  @Field({ description: 'Дата создания' })
  createdAt!: Date;

  constructor(data: {
    id: number;
    imageUrl: string;
    imageType: RequestImageType;
    sortOrder: number;
    description?: string;
    isPrimary: boolean;
    isColorSample: boolean;
    is360Image: boolean;
    typeDescription: string;
    fileName: string;
    createdAt: Date;
  }) {
    this.id = data.id;
    this.imageUrl = data.imageUrl;
    this.imageType = data.imageType;
    this.sortOrder = data.sortOrder;
    this.description = data.description;
    this.isPrimary = data.isPrimary;
    this.isColorSample = data.isColorSample;
    this.is360Image = data.is360Image;
    this.typeDescription = data.typeDescription;
    this.fileName = data.fileName;
    this.createdAt = data.createdAt;
  }

  static fromDomain(entity: RequestImageDomainEntity): RequestImageDTO {
    return new RequestImageDTO({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      id: entity.id!,
      imageUrl: entity.imageUrl,
      imageType: entity.imageType,
      sortOrder: entity.sortOrder,
      description: entity.description,
      isPrimary: entity.isPrimary(),
      isColorSample: entity.isColorSample(),
      is360Image: entity.is360Image(),
      typeDescription: entity.getTypeDescription(),
      fileName: entity.getFileName(),
      createdAt: entity.createdAt,
    });
  }
}

/**
 * DTO для заявки marketplace
 */
@ObjectType('MarketplaceRequest')
export class RequestDTO {
  @Field(() => Int, { description: 'ID заявки' })
  id!: number;

  @Field({ description: 'Уникальный хэш заявки' })
  hash!: string;

  @Field({ description: 'Хэш родительской заявки', nullable: true })
  parentHash?: string;

  @Field({ description: 'Название кооператива' })
  coopname!: string;

  @Field({ description: 'Имя пользователя' })
  username!: string;

  @Field(() => RequestType, { description: 'Тип заявки' })
  type!: RequestType;

  @Field(() => RequestStatus, { description: 'Статус заявки' })
  status!: RequestStatus;

  // Основная информация о товаре
  @Field({ description: 'Название товара' })
  name!: string;

  @Field({ description: 'Артикул товара' })
  articleNumber!: string;

  @Field({ description: 'Штрихкод товара', nullable: true })
  barcode?: string;

  // Категория и тип
  @Field(() => Int, { description: 'ID категории' })
  descriptionCategoryId!: number;

  @Field(() => Int, { description: 'ID типа товара' })
  typeId!: number;

  @Field(() => CategoryDTO, { description: 'Информация о категории' })
  category!: CategoryDTO;

  @Field(() => ProductTypeDTO, { description: 'Информация о типе товара' })
  productType!: ProductTypeDTO;

  // Цены
  @Field(() => Number, { description: 'Цена товара' })
  price!: number;

  @Field(() => Number, { description: 'Цена до скидки', nullable: true })
  oldPrice?: number;

  @Field({ description: 'Валюта' })
  currencyCode!: string;

  @Field({ description: 'Ставка НДС' })
  vat!: string;

  // Вычисляемые поля для цен
  @Field(() => Number, { description: 'Цена как число' })
  priceAsNumber!: number;

  @Field(() => Number, { description: 'Старая цена как число', nullable: true })
  oldPriceAsNumber?: number;

  @Field({ description: 'Есть ли скидка' })
  hasDiscount!: boolean;

  @Field(() => Number, { description: 'Процент скидки' })
  discountPercentage!: number;

  // Габариты и вес
  @Field(() => Int, { description: 'Ширина упаковки', nullable: true })
  width?: number;

  @Field(() => Int, { description: 'Высота упаковки', nullable: true })
  height?: number;

  @Field(() => Int, { description: 'Глубина упаковки', nullable: true })
  depth?: number;

  @Field({ description: 'Единица измерения габаритов', nullable: true })
  dimensionUnit?: string;

  @Field(() => Int, { description: 'Вес товара', nullable: true })
  weight?: number;

  @Field({ description: 'Единица измерения веса', nullable: true })
  weightUnit?: string;

  // Количества
  @Field(() => Int, { description: 'Общее количество единиц' })
  units!: number;

  @Field(() => Int, { description: 'Доступное количество единиц' })
  availableUnits!: number;

  @Field(() => Int, { description: 'Количество проданных единиц' })
  settledUnits!: number;

  // Время жизни и гарантии
  @Field(() => Int, { description: 'Время жизни продукта в секундах', nullable: true })
  productLifecycleSecs?: number;

  @Field(() => Int, { description: 'Гарантийный срок в днях', nullable: true })
  warrantyDays?: number;

  // Дополнительные данные
  @Field({ description: 'Дополнительные данные', nullable: true })
  data?: string;

  @Field({ description: 'Метаданные', nullable: true })
  meta?: string;

  // Связанные сущности
  @Field(() => [RequestAttributeValueDTO], { description: 'Атрибуты заявки' })
  attributes!: RequestAttributeValueDTO[];

  @Field(() => [RequestImageDTO], { description: 'Изображения заявки' })
  images!: RequestImageDTO[];

  @Field({ description: 'URL главного изображения', nullable: true })
  primaryImageUrl?: string;

  @Field({ description: 'URL образца цвета', nullable: true })
  colorImageUrl?: string;

  // Геоограничения
  @Field(() => [String], { description: 'Геоограничения' })
  geoNames!: string[];

  // Статусы и проверки
  @Field({ description: 'Является ли заявка активной' })
  isActive!: boolean;

  @Field({ description: 'Можно ли редактировать заявку' })
  canBeEdited!: boolean;

  @Field({ description: 'Является ли предложением' })
  isOffer!: boolean;

  @Field({ description: 'Является ли заказом' })
  isOrder!: boolean;

  @Field({ description: 'Заполнены ли все обязательные атрибуты' })
  hasAllRequiredAttributes!: boolean;

  // Временные метки
  @Field({ description: 'Дата создания' })
  createdAt!: Date;

  @Field({ description: 'Дата обновления' })
  updatedAt!: Date;

  constructor(data: {
    id: number;
    hash: string;
    parentHash?: string;
    coopname: string;
    username: string;
    type: RequestType;
    status: RequestStatus;
    name: string;
    articleNumber: string;
    barcode?: string;
    descriptionCategoryId: number;
    typeId: number;
    category: CategoryDTO;
    productType: ProductTypeDTO;
    price: number;
    oldPrice?: number;
    currencyCode: string;
    vat: string;
    priceAsNumber: number;
    oldPriceAsNumber?: number;
    hasDiscount: boolean;
    discountPercentage: number;
    width?: number;
    height?: number;
    depth?: number;
    dimensionUnit?: string;
    weight?: number;
    weightUnit?: string;
    units: number;
    availableUnits: number;
    settledUnits: number;
    productLifecycleSecs?: number;
    warrantyDays?: number;
    data?: string;
    meta?: string;
    attributes: RequestAttributeValueDTO[];
    images: RequestImageDTO[];
    primaryImageUrl?: string;
    colorImageUrl?: string;
    geoNames: string[];
    isActive: boolean;
    canBeEdited: boolean;
    isOffer: boolean;
    isOrder: boolean;
    hasAllRequiredAttributes: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = data.id;
    this.hash = data.hash;
    this.parentHash = data.parentHash;
    this.coopname = data.coopname;
    this.username = data.username;
    this.type = data.type;
    this.status = data.status;
    this.name = data.name;
    this.articleNumber = data.articleNumber;
    this.barcode = data.barcode;
    this.descriptionCategoryId = data.descriptionCategoryId;
    this.typeId = data.typeId;
    this.category = data.category;
    this.productType = data.productType;
    this.price = data.price;
    this.oldPrice = data.oldPrice;
    this.currencyCode = data.currencyCode;
    this.vat = data.vat;
    this.priceAsNumber = data.priceAsNumber;
    this.oldPriceAsNumber = data.oldPriceAsNumber;
    this.hasDiscount = data.hasDiscount;
    this.discountPercentage = data.discountPercentage;
    this.width = data.width;
    this.height = data.height;
    this.depth = data.depth;
    this.dimensionUnit = data.dimensionUnit;
    this.weight = data.weight;
    this.weightUnit = data.weightUnit;
    this.units = data.units;
    this.availableUnits = data.availableUnits;
    this.settledUnits = data.settledUnits;
    this.productLifecycleSecs = data.productLifecycleSecs;
    this.warrantyDays = data.warrantyDays;
    this.data = data.data;
    this.meta = data.meta;
    this.attributes = data.attributes;
    this.images = data.images;
    this.primaryImageUrl = data.primaryImageUrl;
    this.colorImageUrl = data.colorImageUrl;
    this.geoNames = data.geoNames;
    this.isActive = data.isActive;
    this.canBeEdited = data.canBeEdited;
    this.isOffer = data.isOffer;
    this.isOrder = data.isOrder;
    this.hasAllRequiredAttributes = data.hasAllRequiredAttributes;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Создать DTO из доменной сущности
   */
  static fromDomain(entity: RequestDomainEntity): RequestDTO {
    return new RequestDTO({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      id: entity.id!,
      hash: entity.hash,
      parentHash: entity.parentHash,
      coopname: entity.coopname,
      username: entity.username,
      type: entity.type,
      status: entity.status,
      name: entity.name,
      articleNumber: entity.articleNumber,
      barcode: entity.barcode,
      descriptionCategoryId: entity.descriptionCategoryId,
      typeId: entity.typeId,
      category: CategoryDTO.fromDomain(entity.category),
      productType: ProductTypeDTO.fromDomain(entity.productType),
      price: entity.price,
      oldPrice: entity.oldPrice,
      currencyCode: entity.currencyCode,
      vat: entity.vat,
      priceAsNumber: entity.getPriceAsNumber(),
      oldPriceAsNumber: entity.getOldPriceAsNumber() || undefined,
      hasDiscount: entity.hasDiscount(),
      discountPercentage: entity.getDiscountPercentage(),
      width: entity.width,
      height: entity.height,
      depth: entity.depth,
      dimensionUnit: entity.dimensionUnit,
      weight: entity.weight,
      weightUnit: entity.weightUnit,
      units: entity.units,
      availableUnits: entity.availableUnits,
      settledUnits: entity.settledUnits,
      productLifecycleSecs: entity.productLifecycleSecs,
      warrantyDays: entity.warrantyDays,
      data: entity.data,
      meta: entity.meta,
      attributes: entity.attributes.map((attr) => RequestAttributeValueDTO.fromDomain(attr)),
      images: entity.images.map((img) => RequestImageDTO.fromDomain(img)),
      primaryImageUrl: entity.primaryImageUrl,
      colorImageUrl: entity.colorImageUrl,
      geoNames: entity.geoNames,
      isActive: entity.isActive(),
      canBeEdited: entity.canBeEdited(),
      isOffer: entity.isOffer(),
      isOrder: entity.isOrder(),
      hasAllRequiredAttributes: entity.hasAllRequiredAttributes(),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
