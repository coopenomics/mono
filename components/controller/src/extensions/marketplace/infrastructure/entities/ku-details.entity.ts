import type {
  GeocodeStatus,
  KuDetailsStatus,
  WorkingHoursDomain,
} from '../../domain/entities/ku-details-domain.entity';

/**
 * TypeORM-сущность `marketplace_ku_details` — 1:1 расширение core `coop_ku`
 * с атрибутами, специфичными для Стола заказов (Эпик 2, Story 2.1).
 *
 * Уникальная пара (`coopname`, `core_braname`): на каждый core-КУ в одном
 * кооперативе — ровно одна marketplace-детализация. Удаление core-КУ
 * приводит к INACTIVE — запись физически сохраняется ради ссылочной
 * целостности с marketplace `Order` / `Shipment` (Эпики 4-5).
 */
export class KuDetailsRecord {
  id!: number;

  coopname!: string;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  coreBraname!: string;

  geocodedAddress?: string;

  workingHoursJson!: WorkingHoursDomain;

  description?: string;

  status!: KuDetailsStatus;

  lat?: number;

  lng?: number;

  geocodeStatus!: GeocodeStatus;

  geocodeErrorMessage?: string;

  geocodedAt?: Date;

  createdAt!: Date;

  updatedAt!: Date;
}
