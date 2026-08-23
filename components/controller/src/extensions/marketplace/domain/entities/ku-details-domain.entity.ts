/**
 * Доменная сущность marketplace-детализации существующего в core кооперативного
 * участка (Эпик 2 Стола заказов, Story 2.1). Расширяет core `coop_ku` 1:1
 * атрибутами, специфичными для Стола заказов: режим работы, описание, статус,
 * геокоординаты.
 *
 * Marketplace **не создаёт** КУ — список управляется core controller'ом
 * (стол председателя → «Кооперативные участки»). Эта entity — пристройка
 * атрибутов ПВЗ.
 *
 * Реквизиты участка (наименование, адрес, контакты) НЕ хранятся здесь —
 * единый источник правды это организация участка (правит председатель в
 * «Кооперативные участки»), они резолвятся живьём. `geocodedAddress` — лишь
 * кэш-ключ: адрес, по которому последний раз посчитаны координаты; служит для
 * ленивого reconcile геокода при расхождении с актуальным адресом организации.
 *
 * Поля геокодинга (`lat`, `lng`, `geocodeStatus`, `geocodeErrorMessage`,
 * `geocodedAt`) обновляются post-effect'ом Story 2.2.
 */
export type KuDetailsStatus = 'ACTIVE' | 'INACTIVE';

export const KuDetailsStatuses = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const satisfies Record<string, KuDetailsStatus>;

export type GeocodeStatus = 'PENDING' | 'OK' | 'FAILED';

export const GeocodeStatuses = {
  PENDING: 'PENDING',
  OK: 'OK',
  FAILED: 'FAILED',
} as const satisfies Record<string, GeocodeStatus>;

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
  /** Адрес, по которому посчитаны координаты (кэш-ключ геокода, не для показа). */
  public readonly geocodedAddress?: string;
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
    geocodedAddress?: string;
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
    this.geocodedAddress = data.geocodedAddress;
    this.workingHours = data.workingHours;
    this.description = data.description;
    this.status = data.status;
    this.lat = data.lat;
    this.lng = data.lng;
    this.geocodeStatus = data.geocodeStatus ?? GeocodeStatuses.PENDING;
    this.geocodeErrorMessage = data.geocodeErrorMessage;
    this.geocodedAt = data.geocodedAt;
    this.createdAt = data.createdAt ?? new Date();
    this.updatedAt = data.updatedAt ?? new Date();
  }

  isActive(): boolean {
    return this.status === KuDetailsStatuses.ACTIVE;
  }

  hasCoordinates(): boolean {
    return this.lat !== undefined && this.lng !== undefined && this.geocodeStatus === GeocodeStatuses.OK;
  }
}
