import { AvailableCategoryDomainEntity } from '../../domain/entities/available-category-domain.entity';
import { AvailableCategoryEntity } from '../entities/available-category.entity';

/**
 * Mapper для преобразования между доменной сущностью и TypeORM entity доступных категорий и типов товаров
 */
export class AvailableCategoryMapper {
  /**
   * Преобразование из TypeORM entity в доменную сущность
   */
  static toDomain(entity: AvailableCategoryEntity): AvailableCategoryDomainEntity {
    return new AvailableCategoryDomainEntity({
      id: entity.id,
      coopname: entity.coopname,
      categoryId: entity.categoryId,
      typeId: entity.typeId,
      isActive: entity.isActive,
      addedBy: entity.addedBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  /**
   * Преобразование из доменной сущности в TypeORM entity
   */
  static toEntity(domain: AvailableCategoryDomainEntity): AvailableCategoryEntity {
    const entity = new AvailableCategoryEntity();
    entity.id = domain.id;
    entity.coopname = domain.coopname;
    entity.categoryId = domain.categoryId;
    entity.typeId = domain.typeId;
    entity.isActive = domain.isActive;
    entity.addedBy = domain.addedBy;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }

  /**
   * Преобразование частичных данных доменной сущности в TypeORM entity
   */
  static toEntityPartial(domainData: Partial<AvailableCategoryDomainEntity>): Partial<AvailableCategoryEntity> {
    const entityData: Partial<AvailableCategoryEntity> = {};

    if (domainData.id !== undefined) entityData.id = domainData.id;
    if (domainData.coopname !== undefined) entityData.coopname = domainData.coopname;
    if (domainData.categoryId !== undefined) entityData.categoryId = domainData.categoryId;
    if (domainData.typeId !== undefined) entityData.typeId = domainData.typeId;
    if (domainData.isActive !== undefined) entityData.isActive = domainData.isActive;
    if (domainData.addedBy !== undefined) entityData.addedBy = domainData.addedBy;
    if (domainData.createdAt !== undefined) entityData.createdAt = domainData.createdAt;
    if (domainData.updatedAt !== undefined) entityData.updatedAt = domainData.updatedAt;

    return entityData;
  }

  /**
   * Преобразование массива entities в массив доменных сущностей
   */
  static toDomainArray(entities: AvailableCategoryEntity[]): AvailableCategoryDomainEntity[] {
    return entities.map((entity) => this.toDomain(entity));
  }

  /**
   * Преобразование массива доменных сущностей в массив entities
   */
  static toEntityArray(domains: AvailableCategoryDomainEntity[]): AvailableCategoryEntity[] {
    return domains.map((domain) => this.toEntity(domain));
  }
}
