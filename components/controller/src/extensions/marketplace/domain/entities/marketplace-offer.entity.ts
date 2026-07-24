import type {
  MarketplaceBarcodeStrategy,
  MarketplaceOfferDeliveryPoint,
  MarketplaceOfferImage,
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
 * Поле `delivery_points` (Эпик 15) — КУ, на которые поставщик готов везти, с
 * минимальным объёмом на каждом. Заменяет упразднённые `cycle_type`/
 * `target_volume`. Валидация (braname ∈ КУ, min ≥ 1) — на уровне
 * `MarketplaceOfferService.create/update`, не на entity (immutable snapshot).
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

  /** КУ поставки с минимальным объёмом на каждом (Эпик 15). */
  public readonly delivery_points!: MarketplaceOfferDeliveryPoint[];
  /**
   * Срок годности имущества в днях. Указывает поставщик при создании
   * предложения. По нему при приёмке считается `expiry_date` позиции склада —
   * основа списания скоропорта (off-chain, крон Эпика 8). НЕ путать с
   * `warranty_days` (гарантийный срок возврата).
   */
  public readonly shelf_life_days!: number;
  /**
   * Гарантийный срок возврата в днях. Устанавливает модератор (председатель)
   * при одобрении предложения. По нему контракт считает `warranty_until`
   * заказа — окно, в течение которого пайщик может вернуть имущество
   * (`submretrn`). НЕ путать со сроком годности `shelf_life_days`.
   */
  public readonly warranty_days!: number;

  public readonly barcode_strategy!: MarketplaceBarcodeStrategy;
  public readonly pack_size!: number | null;

  /** Изображения товара (обложка = индекс 0). Pure-db, ключи bucket'а. */
  public readonly images!: MarketplaceOfferImage[];

  /**
   * Оффер кооператива из обезличенного остатка склада КУ (requirement 76):
   * non-null — продавец кооператив, исполнение мгновенное со склада этого КУ.
   */
  public readonly stock_braname!: string | null;

  /** Исходный оффер поставщика — товарная привязка остатка (для группировки публикаций). */
  public readonly stock_origin_offer_id!: string | null;

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
    delivery_points: MarketplaceOfferDeliveryPoint[];
    shelf_life_days: number;
    warranty_days: number;
    barcode_strategy: MarketplaceBarcodeStrategy;
    pack_size: number | null;
    images: MarketplaceOfferImage[];
    stock_braname: string | null;
    stock_origin_offer_id: string | null;
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
