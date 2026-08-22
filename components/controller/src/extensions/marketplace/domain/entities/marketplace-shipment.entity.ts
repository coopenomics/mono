import type {
  MarketplaceShipmentDeliveryVariant,
  MarketplaceShipmentProps,
  MarketplaceShipmentStatus,
  MarketplaceShipmentTTNData,
} from './marketplace-shipment.types';
import { MarketplaceShipmentStatuses, MarketplaceShipmentDeliveryVariants } from './marketplace-shipment.types';

/**
 * Story 5.1: домен Shipment'а — партия поставки одного поставщика на один КУ.
 *
 * Backend-only сущность (нет on-chain зеркала; on-chain факт фиксируется
 * через АПП-приёмки + `signsupp`/`signchair`). Здесь — pre-shipment планирование
 * (группировка Order'ов из консолидированной заявки по КУ + выбор варианта
 * доставки + генерация ТТН для Варианта Б).
 *
 * Primary-key — `id` (UUID). Естественный ключ unique constraint —
 * `(coopname, cycle_id, braname)` (одна заявка → одна группа на КУ).
 */
export class MarketplaceShipmentDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly cycle_id: string;
  public readonly offerer_account: string;
  public readonly braname: string;
  public delivery_variant: MarketplaceShipmentDeliveryVariant;
  public total_amount: string;
  public ttn_number: string | null;
  public ttn_data: MarketplaceShipmentTTNData | null;
  public ttn_document_id: string | null;
  public status: MarketplaceShipmentStatus;
  public readonly created_at: Date;
  public updated_at: Date;

  constructor(props: MarketplaceShipmentProps) {
    if (!props.id) {
      throw new Error('MarketplaceShipmentDomainEntity: id обязателен.');
    }
    if (!props.coopname || !props.cycle_id || !props.braname || !props.offerer_account) {
      throw new Error('MarketplaceShipmentDomainEntity: coopname/cycle_id/braname/offerer_account обязательны.');
    }
    if (
      props.delivery_variant === MarketplaceShipmentDeliveryVariants.EXPEDITOR &&
      (!props.ttn_number || !props.ttn_data)
    ) {
      throw new Error(
        'MarketplaceShipmentDomainEntity: для Варианта Б обязательны ttn_number и ttn_data.'
      );
    }
    this.id = props.id;
    this.coopname = props.coopname;
    this.cycle_id = props.cycle_id;
    this.offerer_account = props.offerer_account;
    this.braname = props.braname;
    this.delivery_variant = props.delivery_variant;
    this.total_amount = props.total_amount;
    this.ttn_number = props.ttn_number;
    this.ttn_data = props.ttn_data;
    this.ttn_document_id = props.ttn_document_id;
    this.status = props.status;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }

  /** Можно ли стартовать АПП-приёмку (статус ровно SUPPLY_PREPARED). */
  public get can_start_reception(): boolean {
    return this.status === MarketplaceShipmentStatuses.SUPPLY_PREPARED;
  }

  /** Терминальный ли статус для UI (закрыто / отменено). */
  public get is_terminal(): boolean {
    return (
      this.status === MarketplaceShipmentStatuses.ACCEPTED_TO_COOP ||
      this.status === MarketplaceShipmentStatuses.CANCELLED
    );
  }

  /** Вариант Б требует ТТН-документа для подписи и печати. */
  public get requires_ttn(): boolean {
    return this.delivery_variant === MarketplaceShipmentDeliveryVariants.EXPEDITOR;
  }
}
