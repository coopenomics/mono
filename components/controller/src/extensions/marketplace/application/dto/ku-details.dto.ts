import { Field, ObjectType } from '@nestjs/graphql';
import type { KuDetailsDomainEntity } from '../../domain/entities/ku-details-domain.entity';
import { WorkingHoursDTO } from './working-hours.dto';

/**
 * GraphQL-представление marketplace-детализации существующего в core КУ
 * (Story 2.1). Поля `lat`/`lng`/`geocode*` обновляются post-effect'ом
 * Story 2.2 — до выполнения геокодинга `geocodeStatus = 'PENDING'`,
 * координаты отсутствуют.
 */
@ObjectType('MarketplaceKUDetails')
export class KuDetailsDTO {
  @Field(() => String)
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор КУ в core (`braname`)' })
  coreBraname!: string;

  @Field(() => String)
  addressFull!: string;

  @Field(() => String)
  contactPhone!: string;

  @Field(() => String)
  contactEmail!: string;

  @Field(() => WorkingHoursDTO)
  workingHours!: WorkingHoursDTO;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { description: 'ACTIVE | INACTIVE' })
  status!: 'ACTIVE' | 'INACTIVE';

  @Field(() => Number, { nullable: true })
  lat?: number;

  @Field(() => Number, { nullable: true })
  lng?: number;

  @Field(() => String, { description: 'PENDING | OK | FAILED' })
  geocodeStatus!: 'PENDING' | 'OK' | 'FAILED';

  @Field(() => String, { nullable: true })
  geocodeErrorMessage?: string;

  @Field(() => Date, { nullable: true })
  geocodedAt?: Date;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  static fromDomain(domain: KuDetailsDomainEntity): KuDetailsDTO {
    const dto = new KuDetailsDTO();
    dto.coopname = domain.coopname;
    dto.coreBraname = domain.coreBraname;
    dto.addressFull = domain.addressFull;
    dto.contactPhone = domain.contactPhone;
    dto.contactEmail = domain.contactEmail;
    dto.workingHours = domain.workingHours as WorkingHoursDTO;
    dto.description = domain.description;
    dto.status = domain.status;
    dto.lat = domain.lat;
    dto.lng = domain.lng;
    dto.geocodeStatus = domain.geocodeStatus;
    dto.geocodeErrorMessage = domain.geocodeErrorMessage;
    dto.geocodedAt = domain.geocodedAt;
    dto.createdAt = domain.createdAt;
    dto.updatedAt = domain.updatedAt;
    return dto;
  }
}
