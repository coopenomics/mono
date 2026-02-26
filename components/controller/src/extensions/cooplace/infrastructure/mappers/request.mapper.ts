import { RequestDomainEntity, RequestType, RequestStatus } from '../../domain/entities/request-domain.entity';
import { RequestAttributeValueDomainEntity } from '../../domain/entities/request-attribute-value-domain.entity';
import { RequestImageDomainEntity, RequestImageType } from '../../domain/entities/request-image-domain.entity';
import { RequestEntity } from '../entities/request.entity';
import { RequestAttributeValueEntity } from '../entities/request-attribute-value.entity';
import { RequestImageEntity } from '../entities/request-image.entity';
import { CategoryMapper } from './category.mapper';
import { TypeMapper } from './type.mapper';
import { AttributeMapper } from './attribute.mapper';

/**
 * Mapper для преобразования между доменными сущностями заявок и TypeORM entities
 */
export class RequestMapper {
  /**
   * Преобразовать из TypeORM entity в доменную сущность
   */
  static toDomain(entity: RequestEntity): RequestDomainEntity {
    return new RequestDomainEntity({
      id: entity.id,
      hash: entity.hash,
      blockchainId: entity.blockchainId,
      parentId: entity.parentId,
      parentHash: entity.parentHash,
      parentUsername: entity.parentUsername,
      coopname: entity.coopname,
      username: entity.username,
      type: entity.type as RequestType,
      status: entity.status as RequestStatus,
      programId: entity.programId,
      name: entity.name,
      articleNumber: entity.articleNumber,
      barcode: entity.barcode,
      descriptionCategoryId: entity.descriptionCategoryId,
      typeId: entity.typeId,
      category: CategoryMapper.toDomain(entity.category),
      productType: TypeMapper.toDomain(entity.productType),
      unitCost: entity.unitCost,
      price: entity.price,
      oldPrice: entity.oldPrice,
      currencyCode: entity.currencyCode,
      vat: entity.vat,
      supplierAmount: entity.supplierAmount,
      membershipFee: entity.membershipFee,
      totalCost: entity.totalCost,
      cancellationFee: entity.cancellationFee,
      cancellationFeeAmount: entity.cancellationFeeAmount,
      width: entity.width,
      height: entity.height,
      depth: entity.depth,
      dimensionUnit: entity.dimensionUnit,
      weight: entity.weight,
      weightUnit: entity.weightUnit,
      units: entity.units,
      remainUnits: entity.remainUnits,
      blockedUnits: entity.blockedUnits,
      deliveredUnits: entity.deliveredUnits,
      availableUnits: entity.availableUnits,
      settledUnits: entity.settledUnits,
      productLifecycleSecs: entity.productLifecycleSecs,
      warrantyDays: entity.warrantyDays,
      warrantyDelayUntil: entity.warrantyDelayUntil,
      deadlineForReceipt: entity.deadlineForReceipt,
      isWarrantyReturn: entity.isWarrantyReturn,
      warrantyReturnId: entity.warrantyReturnId,
      productContributor: entity.productContributor,
      moneyContributor: entity.moneyContributor,
      data: entity.data,
      meta: entity.meta,
      attributes: entity.attributes ? entity.attributes.map((attr) => this.attributeValueToDomain(attr)) : [],
      images: entity.images ? entity.images.map((img) => this.imageToDomain(img)) : [],
      primaryImageUrl: entity.primaryImageUrl,
      colorImageUrl: entity.colorImageUrl,
      geoNames: entity.geoNames ? JSON.parse(entity.geoNames) : [],
      createdAt: entity.createdAt,
      acceptedAt: entity.acceptedAt,
      suppliedAt: entity.suppliedAt,
      deliveredAt: entity.deliveredAt,
      receivedAt: entity.receivedAt,
      completedAt: entity.completedAt,
      declinedAt: entity.declinedAt,
      cancelledAt: entity.cancelledAt,
      disputedAt: entity.disputedAt,
      updatedAt: entity.updatedAt,
    });
  }

  /**
   * Преобразовать из доменной сущности в TypeORM entity
   */
  static toEntity(domain: RequestDomainEntity): RequestEntity {
    const entity = new RequestEntity();

    if (domain.id) entity.id = domain.id;
    entity.hash = domain.hash;
    entity.blockchainId = domain.blockchainId;
    entity.parentId = domain.parentId;
    entity.parentHash = domain.parentHash;
    entity.parentUsername = domain.parentUsername;
    entity.coopname = domain.coopname;
    entity.username = domain.username;
    entity.type = domain.type as 'offer' | 'order';
    entity.status = domain.status;
    entity.programId = domain.programId;
    entity.name = domain.name;
    entity.articleNumber = domain.articleNumber;
    entity.barcode = domain.barcode;
    entity.descriptionCategoryId = domain.descriptionCategoryId;
    entity.typeId = domain.typeId;
    entity.unitCost = domain.unitCost;
    entity.price = domain.price;
    entity.oldPrice = domain.oldPrice;
    entity.currencyCode = domain.currencyCode;
    entity.vat = domain.vat;
    entity.supplierAmount = domain.supplierAmount;
    entity.membershipFee = domain.membershipFee;
    entity.totalCost = domain.totalCost;
    entity.cancellationFee = domain.cancellationFee;
    entity.cancellationFeeAmount = domain.cancellationFeeAmount;
    entity.width = domain.width;
    entity.height = domain.height;
    entity.depth = domain.depth;
    entity.dimensionUnit = domain.dimensionUnit;
    entity.weight = domain.weight;
    entity.weightUnit = domain.weightUnit;
    entity.units = domain.units;
    entity.remainUnits = domain.remainUnits;
    entity.blockedUnits = domain.blockedUnits;
    entity.deliveredUnits = domain.deliveredUnits;
    entity.availableUnits = domain.availableUnits;
    entity.settledUnits = domain.settledUnits;
    entity.productLifecycleSecs = domain.productLifecycleSecs;
    entity.warrantyDays = domain.warrantyDays;
    entity.warrantyDelayUntil = domain.warrantyDelayUntil;
    entity.deadlineForReceipt = domain.deadlineForReceipt;
    entity.isWarrantyReturn = domain.isWarrantyReturn;
    entity.warrantyReturnId = domain.warrantyReturnId;
    entity.productContributor = domain.productContributor;
    entity.moneyContributor = domain.moneyContributor;
    entity.data = domain.data;
    entity.meta = domain.meta;
    entity.primaryImageUrl = domain.primaryImageUrl;
    entity.colorImageUrl = domain.colorImageUrl;
    entity.geoNames = domain.geoNames.length > 0 ? JSON.stringify(domain.geoNames) : undefined;
    entity.createdAt = domain.createdAt;
    entity.acceptedAt = domain.acceptedAt;
    entity.suppliedAt = domain.suppliedAt;
    entity.deliveredAt = domain.deliveredAt;
    entity.receivedAt = domain.receivedAt;
    entity.completedAt = domain.completedAt;
    entity.declinedAt = domain.declinedAt;
    entity.cancelledAt = domain.cancelledAt;
    entity.disputedAt = domain.disputedAt;
    entity.updatedAt = domain.updatedAt;

    // Преобразование атрибутов
    if (domain.attributes.length > 0) {
      entity.attributes = domain.attributes.map((attr) => this.attributeValueToEntity(attr));
    }

    // Преобразование изображений
    if (domain.images.length > 0) {
      entity.images = domain.images.map((img) => this.imageToEntity(img));
    }

    return entity;
  }

  /**
   * Преобразовать значение атрибута из entity в domain
   */
  private static attributeValueToDomain(entity: RequestAttributeValueEntity): RequestAttributeValueDomainEntity {
    return new RequestAttributeValueDomainEntity({
      id: entity.id,
      requestId: entity.requestId,
      attributeId: entity.attributeId,
      attribute: AttributeMapper.toDomain(entity.attribute),
      complexId: entity.complexId,
      value: entity.value,
      dictionaryValueId: entity.dictionaryValueId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  /**
   * Преобразовать значение атрибута из domain в entity
   */
  private static attributeValueToEntity(domain: RequestAttributeValueDomainEntity): RequestAttributeValueEntity {
    const entity = new RequestAttributeValueEntity();

    if (domain.id) entity.id = domain.id;
    if (domain.requestId) entity.requestId = domain.requestId;
    entity.attributeId = domain.attributeId;
    entity.complexId = domain.complexId;
    entity.value = domain.value;
    entity.dictionaryValueId = domain.dictionaryValueId;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;

    return entity;
  }

  /**
   * Преобразовать изображение из entity в domain
   */
  private static imageToDomain(entity: RequestImageEntity): RequestImageDomainEntity {
    return new RequestImageDomainEntity({
      id: entity.id,
      requestId: entity.requestId,
      imageUrl: entity.imageUrl,
      imageType: entity.imageType as RequestImageType,
      sortOrder: entity.sortOrder,
      description: entity.description,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  /**
   * Преобразовать изображение из domain в entity
   */
  private static imageToEntity(domain: RequestImageDomainEntity): RequestImageEntity {
    const entity = new RequestImageEntity();

    if (domain.id) entity.id = domain.id;
    if (domain.requestId) entity.requestId = domain.requestId;
    entity.imageUrl = domain.imageUrl;
    entity.imageType = domain.imageType as 'regular' | 'primary' | 'color_sample' | 'image_360';
    entity.sortOrder = domain.sortOrder;
    entity.description = domain.description;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;

    return entity;
  }

  /**
   * Преобразовать массив доменных сущностей в массив entities
   */
  static toEntityArray(domains: RequestDomainEntity[]): RequestEntity[] {
    return domains.map((domain) => this.toEntity(domain));
  }

  /**
   * Преобразовать массив entities в массив доменных сущностей
   */
  static toDomainArray(entities: RequestEntity[]): RequestDomainEntity[] {
    return entities.map((entity) => this.toDomain(entity));
  }
}
