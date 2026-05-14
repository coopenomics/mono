/**
 * Доменная сущность marketplace-детализации существующего в core кооперативного
 * участка (Эпик 2 Стола заказов, Story 2.1). Расширяет core `coop_ku` 1:1
 * атрибутами ПВЗ: адрес, контакты, режим работы, геокоординаты.
 *
 * Marketplace **не создаёт** КУ — список управляется core controller'ом
 * (стол председателя → «Кооперативные участки»). Эта entity — пристройка
 * атрибутов, специфичных для Стола заказов.
 *
 * Поля геокодинга (`lat`, `lng`, `geocodeStatus`, `geocodeErrorMessage`,
 * `geocodedAt`) обновляются post-effect'ом Story 2.2.
 */
export type KuDetailsStatus = 'ACTIVE' | 'INACTIVE';

export type GeocodeStatus = 'PENDING' | 'OK' | 'FAILED';

export interface WorkingHoursDayDomain {
  open: string;
  close: string;
  breaks: Array<{ start: string; end: string }>;
}

export type WorkingHoursDomain = Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', WorkingHoursDayDomain>>;

export class KuDetailsDomainEntity {
  public readonly id?: number;
  public readonly coopname: string;
  public readonly coreBraname: string;
  public readonly addressFull: string;
  public readonly contactPhone: string;
  public readonly contactEmail: string;
  public readonly workingHours: WorkingHoursDomain;
  public readonly description?: string;
  public readonly status: KuDetailsStatus;
  public readonly lat?: number;
  public readonly lng?: number;
  public readonly geocodeStatus: GeocodeStatus;
  public readonly geocodeErrorMessage?: string;
  public readonly geocodedAt?: Date;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(data: {
    id?: number;
    coopname: string;
    coreBraname: string;
    addressFull: string;
    contactPhone: string;
    contactEmail: string;
    workingHours: WorkingHoursDomain;
    description?: string;
    status: KuDetailsStatus;
    lat?: number;
    lng?: number;
    geocodeStatus?: GeocodeStatus;
    geocodeErrorMessage?: string;
    geocodedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = data.id;
    this.coopname = data.coopname;
    this.coreBraname = data.coreBraname;
    this.addressFull = data.addressFull;
    this.contactPhone = data.contactPhone;
    this.contactEmail = data.contactEmail;
    this.workingHours = data.workingHours;
    this.description = data.description;
    this.status = data.status;
    this.lat = data.lat;
    this.lng = data.lng;
    this.geocodeStatus = data.geocodeStatus ?? 'PENDING';
    this.geocodeErrorMessage = data.geocodeErrorMessage;
    this.geocodedAt = data.geocodedAt;
    this.createdAt = data.createdAt ?? new Date();
    this.updatedAt = data.updatedAt ?? new Date();
  }

  isActive(): boolean {
    return this.status === 'ACTIVE';
  }

  hasCoordinates(): boolean {
    return this.lat !== undefined && this.lng !== undefined && this.geocodeStatus === 'OK';
  }
}
