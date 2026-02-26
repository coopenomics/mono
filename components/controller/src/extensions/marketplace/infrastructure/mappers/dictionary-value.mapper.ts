import { DictionaryValueEntity } from '../entities/dictionary-value.entity';
import { DictionaryValueDomainEntity } from '../../domain/entities/dictionary-value-domain.entity';
import { DictionaryDomainEntity } from '../../domain/entities/dictionary-domain.entity';

export class DictionaryValueMapper {
  static toDomain(entity: DictionaryValueEntity): DictionaryValueDomainEntity {
    return new DictionaryValueDomainEntity({
      dictionaryValueId: entity.dictionaryValueId,
      value: entity.value,
      info: entity.info,
      picture: entity.picture,
      dictionaryId: entity.dictionaryId,
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
        : ({} as DictionaryDomainEntity),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toEntity(domain: DictionaryValueDomainEntity): DictionaryValueEntity {
    const entity = new DictionaryValueEntity();
    entity.dictionaryValueId = domain.dictionaryValueId;
    entity.value = domain.value;
    entity.info = domain.info;
    entity.picture = domain.picture;
    entity.dictionaryId = domain.dictionaryId;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }
}
