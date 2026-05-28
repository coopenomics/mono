import type {
  MarketplaceBarcodeStrategy,
  MarketplaceOfferCycleType,
  MarketplaceOfferStatus,
  MarketplaceUnitOfMeasure,
} from './marketplace-offer.types';

/**
 * Story 3.2: domain entity Offer'а.
 *
 * Offer — pure db-сущность Стола заказов (не реплицируется в blockchain
 * 1:1). On-chain представления появляются на уровне Order'а (Эпик 4
 * через `o.mkt.lock`/`o.mkt.unlock`). Поля `quantity_blocked`/
 * `quantity_consumed` подготовлены под Story 3.4 counters;
 * `approved_by`/`approved_at`/`rejected_by`/`rejected_at`/`reject_reason`
 * — под Story 3.3 модерацию.
 *
 * Поля `cycle_days`/`target_volume`/`max_wait_days`/`min_threshold`
 * заполняются опционально в зависимости от `cycle_type` — валидация на
 * уровне `MarketplaceOfferService.create/update`, не на entity (immutable
 * snapshot).
 */
export class MarketplaceOfferDomainEntity {
  public readonly id!: string;
  public readonly coopname!: string;
  public readonly supplier_account!: string;
  public readonly vitrine_id!: string;

  public readonly product_name!: string;
  public readonly description!: string | null;
  public readonly category_id!: number;
  public readonly price_per_unit!: string;
  public readonly unit_of_measure!: MarketplaceUnitOfMeasure;

  public readonly quantity_available!: number;
  public readonly quantity_blocked!: number;
  public readonly quantity_consumed!: number;
  public readonly unlimited_flag!: boolean;

  public readonly cycle_type!: MarketplaceOfferCycleType;
  public readonly cycle_days!: number | null;
  public readonly target_volume!: number | null;
  public readonly max_wait_days!: number | null;
  public readonly min_threshold!: number | null;
  public readonly warranty_days!: number;

  public readonly barcode_strategy!: MarketplaceBarcodeStrategy;
  public readonly pack_size!: number | null;

  public readonly status!: MarketplaceOfferStatus;
  public readonly approved_by!: string | null;
  public readonly approved_at!: Date | null;
  public readonly rejected_by!: string | null;
  public readonly rejected_at!: Date | null;
  public readonly reject_reason!: string | null;

  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  constructor(init: {
    id: string;
    coopname: string;
    supplier_account: string;
    vitrine_id: string;
    product_name: string;
    description: string | null;
    category_id: number;
    price_per_unit: string;
    unit_of_measure: MarketplaceUnitOfMeasure;
    quantity_available: number;
    quantity_blocked: number;
    quantity_consumed: number;
    unlimited_flag: boolean;
    cycle_type: MarketplaceOfferCycleType;
    cycle_days: number | null;
    target_volume: number | null;
    max_wait_days: number | null;
    min_threshold: number | null;
    warranty_days: number;
    barcode_strategy: MarketplaceBarcodeStrategy;
    pack_size: number | null;
    status: MarketplaceOfferStatus;
    approved_by: string | null;
    approved_at: Date | null;
    rejected_by: string | null;
    rejected_at: Date | null;
    reject_reason: string | null;
    created_at: Date;
    updated_at: Date;
  }) {
    Object.assign(this, init);
  }
}
