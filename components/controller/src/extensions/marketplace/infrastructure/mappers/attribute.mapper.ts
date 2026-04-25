import { AttributeEntity } from '../entities/attribute.entity';
import { AttributeDomainEntity } from '../../domain/entities/attribute-domain.entity';
import { DictionaryDomainEntity } from '../../domain/entities/dictionary-domain.entity';

export class AttributeMapper {
  static toDomain(entity: AttributeEntity): AttributeDomainEntity {
    return new AttributeDomainEntity({
      attributeId: entity.attributeId,
      name: entity.name,
      description: entity.description,
      type: entity.type,
      isCollection: entity.isCollection,
      isRequired: entity.isRequired,
      isAspect: entity.isAspect,
      maxValueCount: entity.maxValueCount,
      groupName: entity.groupName,
      groupId: entity.groupId,
      dictionaryId: entity.dictionaryId,
      categoryDependent: entity.categoryDependent,
      complexIsCollection: entity.complexIsCollection,
      attributeComplexId: entity.attributeComplexId,
      dictionary: entity.dictionary
        ? new DictionaryDomainEntity({
            dictionaryId: entity.dictionary.dictionaryId,
            name: entity.dictionary.name,
            description: entity.dictionary.description,
            attributes: [],
            values: [],
            createdAt: entity.dictionary.createdAt,
            updatedAt: entity.dictionary.updatedAt,
          })
        : undefined,
      categoryTypeAttributes: [],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toEntity(domain: AttributeDomainEntity): AttributeEntity {
    const entity = new AttributeEntity();
    entity.attributeId = domain.attributeId;
    entity.name = domain.name;
    entity.description = domain.description;
    entity.type = domain.type;
    entity.isCollection = domain.isCollection;
    entity.isRequired = domain.isRequired;
    entity.isAspect = domain.isAspect;
    entity.maxValueCount = domain.maxValueCount;
    entity.groupName = domain.groupName;
    entity.groupId = domain.groupId;
    entity.dictionaryId = domain.dictionaryId;
    entity.categoryDependent = domain.categoryDependent;
    entity.complexIsCollection = domain.complexIsCollection;
    entity.attributeComplexId = domain.attributeComplexId;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }
}
