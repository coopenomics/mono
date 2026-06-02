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
 *  - `RECEIVED` — имущество принято кооперативом по акту приёмки и лежит на
 *    складе КУ; штрих-код может быть ещё не наклеен, полка не назначена.
 *    Запись рождается на закрывающей подписи председателя (`ACCEPTED_TO_COOP`)
 *    независимо от маркировки — склад показывает ВСЁ принятое, штрих-код и
 *    полка опциональны.
 *  - `LABELED` — на имущество наклеен внутренний штрих-код; по-прежнему на
 *    складе КУ до выдачи (Эпик 6). Штрих-код в MVP — лишь способ быстро найти
 *    позицию на полке, не обязательное условие хранения.
 *  - `ISSUED` — выдано пайщику (Эпик 6).
 *  - `RETURNED` — возвращено по гарантии (Эпик 7).
 *  - `WRITTEN_OFF` — списано как скоропорт (Эпик 8).
 */
export type MarketplaceInventoryStatus =
  | 'RECEIVED'
  | 'LABELED'
  | 'ISSUED'
  | 'RETURNED'
  | 'WRITTEN_OFF';

export const MarketplaceInventoryStatuses = {
  RECEIVED: 'RECEIVED',
  LABELED: 'LABELED',
  ISSUED: 'ISSUED',
  RETURNED: 'RETURNED',
  WRITTEN_OFF: 'WRITTEN_OFF',
} as const satisfies Record<string, MarketplaceInventoryStatus>;

/** Статусы «физически на складе КУ» — для фильтра склада и крон-сканера. */
export const MarketplaceInventoryOnWarehouseStatuses: readonly MarketplaceInventoryStatus[] = [
  MarketplaceInventoryStatuses.RECEIVED,
  MarketplaceInventoryStatuses.LABELED,
];

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
  /**
   * Значение штрих-кода (хранится с лидирующими нулями для EAN-13). NULL,
   * пока позиция принята на склад, но ещё не промаркирована — штрих-код в
   * MVP опционален.
   */
  barcode_value: string | null;
  barcode_format: MarketplaceBarcodeFormat | null;
  order_id: string;
  shipment_id: string;
  braname: string;
  status: MarketplaceInventoryStatus;
  /** Снапшот наименования и количества — для печати наклейки. */
  product_name_snapshot: string;
  quantity_per_label: number;
  orderer_account_snapshot: string;
  /**
   * Полка/ячейка склада, куда оператор положил эту позицию (свободная строка,
   * напр. «A-12»). NULL — место ещё не назначено. Одну принятую позицию можно
   * разложить на несколько полок, разбив её на отдельные записи (split).
   */
  shelf: string | null;
  /** Момент приёмки кооперативом по акту (закрывающая подпись председателя). */
  received_at: Date;
  /** Account оператора КУ, оформившего приёмку. */
  received_by_operator_account: string;
  /** Момент маркировки штрих-кодом; NULL, пока позиция не промаркирована. */
  labeled_at: Date | null;
  labeled_by_operator_account: string | null;
  /**
   * Story 8.3 (Эпик 8): срок годности позиции. Проставляется при приёмке как
   * `received_at + Offer.warranty_days * 86400`. По нему крон Эпика 8
   * формирует DRAFT-проект списания, когда срок годности истёк уже более чем
   * `writeoff.post_expiry_grace_days` дней назад (`expiry_date <= now - grace`).
   *
   * Nullable: для позиций с бессрочными офферами (`warranty_days = 0`) и
   * исторических записей без warranty_days.
   */
  expiry_date: Date | null;
  created_at: Date;
  updated_at: Date;
}
