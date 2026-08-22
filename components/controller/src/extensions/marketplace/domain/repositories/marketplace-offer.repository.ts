import type {
  MarketplaceOfferDomainEntity,
} from '../entities/marketplace-offer.entity';
import type {
  MarketplaceBarcodeStrategy,
  MarketplaceOfferDeliveryPoint,
  MarketplaceOfferImage,
  MarketplaceOfferPackage,
  MarketplaceOfferPackageInput,
  MarketplaceOfferStatus,
  MarketplaceSaleForm,
} from '../entities/marketplace-offer.types';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

export const MARKETPLACE_OFFER_REPOSITORY = Symbol('MARKETPLACE_OFFER_REPOSITORY');

export interface OfferListFilter {
  coopname: string;
  supplier_account?: string;
  status?: MarketplaceOfferStatus | MarketplaceOfferStatus[];
  category_id?: number;
  available_only?: boolean;
  /**
   * Эпик 16 (Story 16.3): КУ доставки. Если задан — в каталоге остаются
   * только офферы, чей `delivery_points` содержит этот braname (поставщик
   * возит на этот пункт выдачи).
   */
  delivery_braname?: string;
}

export interface OfferCreateInput {
  coopname: string;
  supplier_account: string;
  vitrine_id: string;
  product_name: string;
  description: string | null;
  category_id: number;
  price_per_unit: string;
  unit_of_measure: 'piece' | 'kg' | 'liter';
  /** Способ отпуска (Эпик 18): by_measure | packaged. */
  sale_form: MarketplaceSaleForm;
  /** Каталог упаковок (Эпик 18); пустой при отпуске по мере. */
  packages: MarketplaceOfferPackage[];
  quantity_available: number;
  unlimited_flag: boolean;
  delivery_points: MarketplaceOfferDeliveryPoint[];
  /** Срок годности в днях (поставщик) — основа списания скоропорта. */
  shelf_life_days: number;
  /** Гарантийный срок возврата в днях (модератор) — окно возврата. */
  warranty_days: number;
  barcode_strategy: MarketplaceBarcodeStrategy;
  pack_size: number | null;
  images: MarketplaceOfferImage[];
  /** Оффер кооператива из остатка склада КУ (requirement 76); null — обычный оффер поставщика. */
  stock_braname?: string | null;
  /** Исходный оффер поставщика — товарная привязка остатка. */
  stock_origin_offer_id?: string | null;
}

export interface OfferUpdateInput {
  product_name?: string;
  description?: string | null;
  category_id?: number;
  price_per_unit?: string;
  unit_of_measure?: 'piece' | 'kg' | 'liter';
  /** Способ отпуска (Эпик 18). */
  sale_form?: MarketplaceSaleForm;
  /**
   * Каталог упаковок (Эпик 18), сырой вход поставщика — если передан,
   * полностью заменяет набор. Сервис нормализует в хранимую форму (id/sort_order)
   * до записи.
   */
  packages?: MarketplaceOfferPackageInput[];
  quantity_available?: number;
  unlimited_flag?: boolean;
  delivery_points?: MarketplaceOfferDeliveryPoint[];
  /** Срок годности в днях (правит поставщик). */
  shelf_life_days?: number;
  /** Гарантийный срок возврата в днях (правит модератор). */
  warranty_days?: number;
  barcode_strategy?: MarketplaceBarcodeStrategy;
  pack_size?: number | null;
  /** Если передан — полностью заменяет набор изображений Offer'а. */
  images?: MarketplaceOfferImage[];
}

/**
 * Story 3.4 — атомарные дельты counters Offer'а.
 *
 * Каждый из методов выполняется одним SQL UPDATE с returning, чтобы:
 *  (а) избежать race condition между read-modify-write при параллельных
 *      Order-блокировках одного Offer'а;
 *  (б) проверить инварианты в WHERE и вернуть 0 affected rows если
 *      операция нарушила бы инвариант (caller получит OfferCountersError).
 *
 * При `unlimited_flag=true` `quantity_available` не изменяется (offer не
 * ограничен по количеству) — только `quantity_blocked` инкрементируется
 * при block / decrement при unblock|consume.
 */
export type OfferCountersErrorReason =
  | 'insufficient_available'
  | 'insufficient_blocked'
  | 'offer_not_active'
  | 'offer_not_found';

export interface OfferCountersDeltaResult {
  ok: boolean;
  reason?: OfferCountersErrorReason;
  offer?: MarketplaceOfferDomainEntity;
}

export interface MarketplaceOfferDomainRepository {
  findById(id: string): Promise<MarketplaceOfferDomainEntity | null>;
  /**
   * Батч-выборка Offer'ов по набору id одним запросом. Используется для
   * обогащения списков заказов отображаемыми реквизитами товара
   * (название, единица измерения) без N+1.
   */
  findByIds(ids: string[]): Promise<MarketplaceOfferDomainEntity[]>;
  list(
    filter: OfferListFilter,
    pagination: PaginationInputDTO
  ): Promise<PaginationResult<MarketplaceOfferDomainEntity>>;
  countByCategory(
    coopname: string,
    delivery_braname?: string | null
  ): Promise<Map<number, number>>;
  countRecentCreatedBy(supplier_account: string, sinceMs: number): Promise<number>;
  create(input: OfferCreateInput): Promise<MarketplaceOfferDomainEntity>;
  applyUpdate(
    id: string,
    patch: OfferUpdateInput & {
      status?: MarketplaceOfferStatus;
      approved_by?: string | null;
      approved_at?: Date | null;
      rejected_by?: string | null;
      rejected_at?: Date | null;
      reject_reason?: string | null;
    }
  ): Promise<MarketplaceOfferDomainEntity>;

  /**
   * Order создан → блокировать K единиц. Атомарно:
   *   - quantity_blocked += K;
   *   - quantity_available -= K (если не unlimited);
   *   - требование: status='ACTIVE' AND (unlimited OR available >= K).
   */
  applyBlockDelta(offer_id: string, qty: number): Promise<OfferCountersDeltaResult>;

  /**
   * Order отменён / цикл expire / поставщик отказался → возврат
   * K единиц в available. Атомарно:
   *   - quantity_blocked -= K;
   *   - quantity_available += K (если не unlimited);
   *   - требование: blocked >= K.
   */
  applyUnblockDelta(offer_id: string, qty: number): Promise<OfferCountersDeltaResult>;

  /**
   * Выдача пайщику (consum/consum2) → K единиц перемещаются
   * blocked → consumed. Атомарно:
   *   - quantity_blocked -= K;
   *   - quantity_consumed += K;
   *   - требование: blocked >= K.
   */
  applyConsumeDelta(offer_id: string, qty: number): Promise<OfferCountersDeltaResult>;

  /**
   * Fork rollback (ADR-005): Order был в block-состоянии и откатывается
   * `restoreFromVersions`. Counter в Offer'е возвращается **без
   * CAS-проверки** `blocked>=qty` — rollback может приходить когда
   * сама блокировка уже была списана (Order успел уйти в consumed),
   * и тогда мы выйдем в отрицательные значения (ожидаемо при
   * катастрофе fork-вне-Rollback-Horizon из ADR-005; fix через manual
   * reconciliation, FR12 ARCH-sync).
   *
   * Дёргается из ForkRegistry handler'а `MarketplaceOrderSyncService`.
   * См. spec-3-4-bc-integration.md секция 3.1.
   */
  applyRollbackDelta(offer_id: string, qty: number): Promise<OfferCountersDeltaResult>;
}
