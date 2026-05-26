/**
 * Story 5.5: типы инвентарной записи — внутренний штрих-код имущества на КУ.
 *
 * Формат — Code128 (для произвольной длины буквенно-цифровой кодировки) либо
 * EAN-13 (только цифровая, 13 знаков). QR-коды в MVP запрещены (стандарт
 * маркетплейсов на маркировке имущества — линейные штрих-коды).
 */
export type MarketplaceBarcodeFormat = 'CODE128' | 'EAN13';

export const MarketplaceBarcodeFormats = {
  CODE128: 'CODE128',
  EAN13: 'EAN13',
} as const satisfies Record<string, MarketplaceBarcodeFormat>;

/**
 * Состояние единицы имущества в инвентаре КУ.
 *
 *  - `LABELED` — этикетка наклеена, имущество на складе КУ до выдачи (Эпик 6).
 *  - `ISSUED` — выдано пайщику (резерв, обновляется на Эпике 6).
 *  - `RETURNED` — возвращено по гарантии (резерв, Эпик 7).
 *  - `WRITTEN_OFF` — списано как скоропорт (резерв, Эпик 8).
 */
export type MarketplaceInventoryStatus =
  | 'LABELED'
  | 'ISSUED'
  | 'RETURNED'
  | 'WRITTEN_OFF';

export const MarketplaceInventoryStatuses = {
  LABELED: 'LABELED',
  ISSUED: 'ISSUED',
  RETURNED: 'RETURNED',
  WRITTEN_OFF: 'WRITTEN_OFF',
} as const satisfies Record<string, MarketplaceInventoryStatus>;

/**
 * Стратегия маркировки per-Offer (определяется поставщиком при создании
 * Offer'а, в MVP — single config-default).
 *
 *  - `PER_ORDER` — одна этикетка на весь заказ независимо от quantity.
 *  - `PER_UNIT` — N этикеток на N единиц quantity.
 *  - `PER_PACKAGE` — одна этикетка на упаковку (для оптовых поставок —
 *    quantity делится на pack_size).
 */
export type MarketplaceBarcodeStrategy = 'PER_ORDER' | 'PER_UNIT' | 'PER_PACKAGE';

export const MarketplaceBarcodeStrategies = {
  PER_ORDER: 'PER_ORDER',
  PER_UNIT: 'PER_UNIT',
  PER_PACKAGE: 'PER_PACKAGE',
} as const satisfies Record<string, MarketplaceBarcodeStrategy>;

export interface MarketplaceInventoryProps {
  id: string;
  coopname: string;
  /** Значение штрих-кода (хранится с лидирующими нулями для EAN-13). */
  barcode_value: string;
  barcode_format: MarketplaceBarcodeFormat;
  order_id: string;
  shipment_id: string;
  braname: string;
  status: MarketplaceInventoryStatus;
  /** Снапшот наименования и количества — для печати наклейки. */
  product_name_snapshot: string;
  quantity_per_label: number;
  orderer_account_snapshot: string;
  labeled_at: Date;
  labeled_by_operator_account: string;
  /**
   * Story 8.3 (Эпик 8): срок годности позиции. Проставляется при
   * маркировке как `labeled_at + Offer.warranty_days * 86400`. По нему
   * крон Эпика 8 формирует DRAFT-проект списания, когда срок годности
   * истёк (`expiry_date <= now`).
   *
   * Nullable: для исторических записей без warranty_days и для позиций
   * с бессрочными офферами (`warranty_days = 0`).
   */
  expiry_date: Date | null;
  created_at: Date;
  updated_at: Date;
}
