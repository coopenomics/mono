import { CategoryEntity } from '../entities/category.entity';
import { CategoryDomainEntity } from '../../domain/entities/category-domain.entity';
import { TypeDomainEntity } from '../../domain/entities/type-domain.entity';

export class CategoryMapper {
  static toDomain(entity: CategoryEntity): CategoryDomainEntity {
    return new CategoryDomainEntity({
      descriptionCategoryId: entity.descriptionCategoryId,
      categoryName: entity.categoryName,
      disabled: entity.disabled,
      parentId: entity.parentId,
      parent: entity.parent ? CategoryMapper.toDomain(entity.parent) : undefined,
      children: entity.children ? entity.children.map((child) => CategoryMapper.toDomain(child)) : [],
      types: entity.types
        ? entity.types.map(
            (type) =>
              new TypeDomainEntity({
                typeId: type.typeId,
                typeName: type.typeName,
                disabled: type.disabled,
                descriptionCategoryId: type.descriptionCategoryId,
                category: {} as CategoryDomainEntity, // Временная заглушка для избежания циклических зависимостей
                categoryTypeAttributes: [],
                createdAt: type.createdAt,
                updatedAt: type.updatedAt,
              })
          )
        : [],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toEntity(domain: CategoryDomainEntity): CategoryEntity {
    const entity = new CategoryEntity();
    entity.descriptionCategoryId = domain.descriptionCategoryId;
    entity.categoryName = domain.categoryName;
    entity.disabled = domain.disabled;
    entity.parentId = domain.parentId;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }

  static toEntityPartial(domain: Partial<CategoryDomainEntity>): Partial<CategoryEntity> {
    const entity: Partial<CategoryEntity> = {};
    if (domain.descriptionCategoryId !== undefined) entity.descriptionCategoryId = domain.descriptionCategoryId;
    if (domain.categoryName !== undefined) entity.categoryName = domain.categoryName;
    if (domain.disabled !== undefined) entity.disabled = domain.disabled;
    if (domain.parentId !== undefined) entity.parentId = domain.parentId;
    return entity;
  }
}
