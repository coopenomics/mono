import { TypeEntity } from '../entities/type.entity';
import { TypeDomainEntity } from '../../domain/entities/type-domain.entity';
import { CategoryDomainEntity } from '../../domain/entities/category-domain.entity';

export class TypeMapper {
  static toDomain(entity: TypeEntity): TypeDomainEntity {
    return new TypeDomainEntity({
      typeId: entity.typeId,
      typeName: entity.typeName,
      disabled: entity.disabled,
      descriptionCategoryId: entity.descriptionCategoryId,
      category: entity.category
        ? new CategoryDomainEntity({
            descriptionCategoryId: entity.category.descriptionCategoryId,
            categoryName: entity.category.categoryName,
            disabled: entity.category.disabled,
            parentId: entity.category.parentId,
            children: [],
            types: [],
            createdAt: entity.category.createdAt,
            updatedAt: entity.category.updatedAt,
          })
        : ({} as CategoryDomainEntity),
      categoryTypeAttributes: [],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toEntity(domain: TypeDomainEntity): TypeEntity {
    const entity = new TypeEntity();
    entity.typeId = domain.typeId;
    entity.typeName = domain.typeName;
    entity.disabled = domain.disabled;
    entity.descriptionCategoryId = domain.descriptionCategoryId;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }
}
