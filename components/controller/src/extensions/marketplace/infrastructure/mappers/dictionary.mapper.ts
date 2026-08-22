import { DictionaryEntity } from '../entities/dictionary.entity';
import { DictionaryDomainEntity } from '../../domain/entities/dictionary-domain.entity';
import { DictionaryValueDomainEntity } from '../../domain/entities/dictionary-value-domain.entity';

export class DictionaryMapper {
  static toDomain(entity: DictionaryEntity): DictionaryDomainEntity {
    return new DictionaryDomainEntity({
      dictionaryId: entity.dictionaryId,
      name: entity.name,
      description: entity.description,
      attributes: [],
      values: entity.values
        ? entity.values.map(
            (value) =>
              new DictionaryValueDomainEntity({
                dictionaryValueId: value.dictionaryValueId,
                value: value.value,
                info: value.info,
                picture: value.picture,
                dictionaryId: value.dictionaryId,
                dictionary: {} as DictionaryDomainEntity, // Временная заглушка для избежания циклических зависимостей
                createdAt: value.createdAt,
                updatedAt: value.updatedAt,
              })
          )
        : [],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toEntity(domain: DictionaryDomainEntity): DictionaryEntity {
    const entity = new DictionaryEntity();
    entity.dictionaryId = domain.dictionaryId;
    entity.name = domain.name;
    entity.description = domain.description;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }
}
