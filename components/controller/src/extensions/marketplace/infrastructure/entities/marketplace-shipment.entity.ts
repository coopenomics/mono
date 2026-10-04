import type {
  MarketplaceShipmentDeliveryVariant,
  MarketplaceShipmentStatus,
  MarketplaceShipmentTTNData,
} from '../../domain/entities/marketplace-shipment.types';

/**
 * Story 5.1: TypeORM-сущность Shipment'а. Backend-only (нет on-chain зеркала)
 * — фиксирует группировку Order'ов одной консолидированной заявки по КУ +
 * вариант доставки.
 *
 * Естественный ключ unique: (coopname, cycle_id, braname) — одна заявка имеет
 * ровно одну группу на каждый КУ.
 *
 * Hot-path индексы:
 *   - `(coopname, offerer_account, status)` — offerer-стол "Подготовка
 *     поставки" (Story 5.1) и "Готовые к отправке" (Story 5.6 trigger);
 *   - `(coopname, braname, status)` — operator-стол КУ «Принять партии» (Story 5.3/5.4);
 *   - `(coopname, ttn_number)` unique sparse — Story 5.4 поиск по ТТН/штрих-коду.
 */
export class MarketplaceShipmentEntity {
  public id!: string;

  public coopname!: string;

  public cycle_id!: string;

  public offerer_account!: string;

  public braname!: string;

  public delivery_variant!: MarketplaceShipmentDeliveryVariant;

  public total_amount!: string;

  // length=64: номер ТТН = COOPNAME-TTN-<cycle8>-<ku6>-<suffix8> + дефисы ≈ 36–42
  // символов (varchar(32) переполнялся при формировании партии экспедитора).
  public ttn_number!: string | null;

  public ttn_data!: MarketplaceShipmentTTNData | null;

  public ttn_document_id!: string | null;

  public status!: MarketplaceShipmentStatus;

  public created_at!: Date;

  public updated_at!: Date;
}
