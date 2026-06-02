import { KuDetailsDomainEntity } from '../../domain/entities/ku-details-domain.entity';
import { KuDetailsTypeormEntity } from '../entities/ku-details.entity';

export class KuDetailsMapper {
  static toDomain(entity: KuDetailsTypeormEntity): KuDetailsDomainEntity {
    return new KuDetailsDomainEntity({
      id: entity.id,
      coopname: entity.coopname,
      coreBraname: entity.coreBraname,
      geocodedAddress: entity.geocodedAddress ?? undefined,
      workingHours: entity.workingHoursJson,
      description: entity.description ?? undefined,
      status: entity.status,
      lat: entity.lat ?? undefined,
      lng: entity.lng ?? undefined,
      geocodeStatus: entity.geocodeStatus,
      geocodeErrorMessage: entity.geocodeErrorMessage ?? undefined,
      geocodedAt: entity.geocodedAt ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toEntity(domain: KuDetailsDomainEntity): KuDetailsTypeormEntity {
    const entity = new KuDetailsTypeormEntity();
    if (domain.id !== undefined) entity.id = domain.id;
    entity.coopname = domain.coopname;
    entity.coreBraname = domain.coreBraname;
    entity.geocodedAddress = domain.geocodedAddress;
    entity.workingHoursJson = domain.workingHours;
    entity.description = domain.description;
    entity.status = domain.status;
    entity.lat = domain.lat;
    entity.lng = domain.lng;
    entity.geocodeStatus = domain.geocodeStatus;
    entity.geocodeErrorMessage = domain.geocodeErrorMessage;
    entity.geocodedAt = domain.geocodedAt;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }
}
