import type {
  MarketplaceBarcodeFormat,
  MarketplaceInventoryOwnership,
  MarketplaceInventoryProps,
  MarketplaceInventoryStatus,
} from './marketplace-inventory.types';

/**
 * Единица имущества на складе КУ. Рождается на приёмке кооперативом по акту
 * (`ACCEPTED_TO_COOP`) — одна запись на принятый Order. Штрих-код (`barcode_value`)
 * и полка (`shelf`) опциональны: позиция лежит на складе и без них. Маркировка
 * наклеивает штрих-код (статус → `LABELED`) как способ быстро найти позицию;
 * раскладка по полкам разбивает позицию на несколько записей (split).
 */
export class MarketplaceInventoryDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly barcode_value: string | null;
  public readonly barcode_format: MarketplaceBarcodeFormat | null;
  public readonly order_id: string;
  public readonly shipment_id: string;
  public readonly braname: string;
  public status: MarketplaceInventoryStatus;
  public readonly product_name_snapshot: string;
  public readonly quantity_per_label: number;
  public readonly orderer_account_snapshot: string;
  public readonly shelf: string | null;
  public readonly received_at: Date;
  public readonly received_by_operator_account: string;
  public readonly labeled_at: Date | null;
  public readonly labeled_by_operator_account: string | null;
  public readonly expiry_date: Date | null;
  public readonly ownership: MarketplaceInventoryOwnership;
  public readonly arrival_price: string | null;
  public readonly published_offer_id: string | null;
  public readonly reserved_order_id: string | null;
  public readonly created_at: Date;
  public updated_at: Date;

  constructor(props: MarketplaceInventoryProps) {
    if (props.barcode_value && props.barcode_format === 'EAN13' && !/^\d{13}$/.test(props.barcode_value)) {
      throw new Error(
        `MarketplaceInventoryDomainEntity: EAN-13 должен быть 13-значным числом (получено: "${props.barcode_value}")`
      );
    }
    if (props.quantity_per_label <= 0) {
      throw new Error('MarketplaceInventoryDomainEntity: quantity_per_label должен быть положительным.');
    }
    this.id = props.id;
    this.coopname = props.coopname;
    this.barcode_value = props.barcode_value ?? null;
    this.barcode_format = props.barcode_format ?? null;
    this.order_id = props.order_id;
    this.shipment_id = props.shipment_id;
    this.braname = props.braname;
    this.status = props.status;
    this.product_name_snapshot = props.product_name_snapshot;
    this.quantity_per_label = props.quantity_per_label;
    this.orderer_account_snapshot = props.orderer_account_snapshot;
    this.shelf = props.shelf ?? null;
    this.received_at = props.received_at;
    this.received_by_operator_account = props.received_by_operator_account;
    this.labeled_at = props.labeled_at ?? null;
    this.labeled_by_operator_account = props.labeled_by_operator_account ?? null;
    this.expiry_date = props.expiry_date ?? null;
    this.ownership = props.ownership;
    this.arrival_price = props.arrival_price ?? null;
    this.published_offer_id = props.published_offer_id ?? null;
    this.reserved_order_id = props.reserved_order_id ?? null;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }
}
