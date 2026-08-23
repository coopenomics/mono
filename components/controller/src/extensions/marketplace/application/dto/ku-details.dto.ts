import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  GeocodeStatuses,
  KuDetailsStatuses,
  type KuDetailsDomainEntity,
} from '../../domain/entities/ku-details-domain.entity';
import { WorkingHoursDTO } from './working-hours.dto';

export const KuDetailsStatusEnum = KuDetailsStatuses;
export type KuDetailsStatusEnum = (typeof KuDetailsStatusEnum)[keyof typeof KuDetailsStatusEnum];
registerEnumType(KuDetailsStatusEnum, {
  name: 'MarketplaceKUStatus',
  description: 'Статус подключения ПВЗ: ACTIVE — активен, INACTIVE — отключён.',
});

export const GeocodeStatusEnum = GeocodeStatuses;
export type GeocodeStatusEnum = (typeof GeocodeStatusEnum)[keyof typeof GeocodeStatusEnum];
registerEnumType(GeocodeStatusEnum, {
  name: 'MarketplaceGeocodeStatus',
  description: 'Состояние геокодинга адреса: PENDING — в процессе, OK — успешно, FAILED — ошибка.',
});

// GraphQL-представление marketplace-детализации существующего в core КУ.
// Реквизиты участка (`name`/`addressFull`/`contactPhone`/`contactEmail`) НЕ
// хранятся в детализации — их отдаёт field-резолвер живьём из организации
// участка (единый источник правды). Поля lat/lng/geocode* обновляются
// post-effect'ом геокодера — до его выполнения geocodeStatus = 'PENDING'.
@ObjectType('MarketplaceKUDetails')
export class KuDetailsDTO {
  @Field(() => String)
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор КУ в core (`braname`)' })
  coreBraname!: string;

  @Field(() => WorkingHoursDTO)
  workingHours!: WorkingHoursDTO;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => KuDetailsStatusEnum)
  status!: KuDetailsStatusEnum;

  @Field(() => Number, { nullable: true })
  lat?: number;

  @Field(() => Number, { nullable: true })
  lng?: number;

  @Field(() => GeocodeStatusEnum)
  geocodeStatus!: GeocodeStatusEnum;

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
