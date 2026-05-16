import type {
  MarketplaceBarcodeFormat,
  MarketplaceInventoryProps,
  MarketplaceInventoryStatus,
} from './marketplace-inventory.types';

/**
 * Story 5.5: единица инвентаря на КУ — этикетка штрих-кода, наклеенная
 * на физическое имущество одного Order'а (либо одной единицы quantity при
 * `PER_UNIT` стратегии).
 *
 * Естественный ключ — `barcode_value` (unique per coopname). Используется
 * стандартным линейным сканером маркетплейса при выдаче (Эпик 6).
 */
export class MarketplaceInventoryDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly barcode_value: string;
  public readonly barcode_format: MarketplaceBarcodeFormat;
  public readonly order_id: string;
  public readonly shipment_id: string;
  public readonly ku_id: string;
  public status: MarketplaceInventoryStatus;
  public readonly product_name_snapshot: string;
  public readonly quantity_per_label: number;
  public readonly orderer_account_snapshot: string;
  public readonly labeled_at: Date;
  public readonly labeled_by_operator_account: string;
  public readonly created_at: Date;
  public updated_at: Date;

  constructor(props: MarketplaceInventoryProps) {
    if (!props.barcode_value || props.barcode_value.length === 0) {
      throw new Error('MarketplaceInventoryDomainEntity: barcode_value обязателен.');
    }
    if (props.barcode_format === 'EAN13' && !/^\d{13}$/.test(props.barcode_value)) {
      throw new Error(
        `MarketplaceInventoryDomainEntity: EAN-13 должен быть 13-значным числом (получено: "${props.barcode_value}")`
      );
    }
    if (props.quantity_per_label <= 0) {
      throw new Error('MarketplaceInventoryDomainEntity: quantity_per_label должен быть положительным.');
    }
    this.id = props.id;
    this.coopname = props.coopname;
    this.barcode_value = props.barcode_value;
    this.barcode_format = props.barcode_format;
    this.order_id = props.order_id;
    this.shipment_id = props.shipment_id;
    this.ku_id = props.ku_id;
    this.status = props.status;
    this.product_name_snapshot = props.product_name_snapshot;
    this.quantity_per_label = props.quantity_per_label;
    this.orderer_account_snapshot = props.orderer_account_snapshot;
    this.labeled_at = props.labeled_at;
    this.labeled_by_operator_account = props.labeled_by_operator_account;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }
}
