/**
 * Story 5.1: типы Shipment'а (партия поставки) — backend-only представление
 * группы Order'ов одного поставщика на один кооперативный участок (КУ) с
 * выбранным вариантом доставки (А — лично везу / Б — экспедитор + ТТН).
 *
 * Shipment живёт в PG; on-chain зеркала пока нет (FR18: канон ТЭМ оставляет
 * фиксацию факта поставки в АПП через `signsupp`/`signchair`). Эту
 * пред-стадию backend использует исключительно для UX-группировки заявки и
 * выбора варианта доставки.
 */

/**
 * Вариант доставки: А — поставщик лично везёт; Б — через экспедитора с ТТН.
 */
export type MarketplaceShipmentDeliveryVariant = 'A' | 'B';

export const MarketplaceShipmentDeliveryVariants = {
  /** Поставщик лично везёт партию на КУ-получатель. */
  SELF: 'A',
  /** Экспедитор везёт по ТТН с асинхронной подписью поставщика. */
  EXPEDITOR: 'B',
} as const satisfies Record<string, MarketplaceShipmentDeliveryVariant>;

/**
 * Статус Shipment'а — отображает текущее место в pre-shipment / приёмке.
 *
 *  - `DRAFT` — группа сформирована, вариант ещё не выбран (резерв на будущее).
 *  - `SUPPLY_PREPARED` — вариант выбран, для Варианта Б ТТН сгенерирована;
 *    группа готова к приёмке (Story 5.3/5.4).
 *  - `RECEPTION_IN_PROGRESS` — АПП-приёмка стартовала на КУ (есть запись
 *    `marketplace_apl_reception` со status PENDING_*).
 *  - `ACCEPTED_TO_COOP` — закрывающая подпись председателя проставлена
 *    (Story 5.6); имущество на складе КУ.
 *  - `CANCELLED` — поставщик отозвал группу до приёмки (резерв).
 */
export type MarketplaceShipmentStatus =
  | 'DRAFT'
  | 'SUPPLY_PREPARED'
  | 'RECEPTION_IN_PROGRESS'
  | 'ACCEPTED_TO_COOP'
  | 'CANCELLED';

export const MarketplaceShipmentStatuses = {
  DRAFT: 'DRAFT',
  SUPPLY_PREPARED: 'SUPPLY_PREPARED',
  RECEPTION_IN_PROGRESS: 'RECEPTION_IN_PROGRESS',
  ACCEPTED_TO_COOP: 'ACCEPTED_TO_COOP',
  CANCELLED: 'CANCELLED',
} as const satisfies Record<string, MarketplaceShipmentStatus>;

/**
 * Данные ТТН для Варианта Б (Story 5.1 form). Хранятся вместе с Shipment
 * jsonb-полем `ttn_data`.
 */
/**
 * Экспедиторская упаковка одной строки партии: сколько единиц имущества
 * поставщик кладёт в одну коробку при отгрузке экспедитору. Задаётся при
 * формировании партии (не при создании предложения) — упаковка для перевозки
 * не равна тому, что выдаётся заказчику. Число коробок выводится как
 * `ceil(quantity / units_per_box)`; нужно экспедитору, поставщику и оператору
 * ПВЗ при приёмке (печатается в ТТН).
 */
export interface MarketplaceShipmentLinePackaging {
  /** Заказ партии, к которому относится упаковка. */
  order_id: string;
  /** Сколько единиц имущества в одной коробке. */
  units_per_box: number;
}

// Все поля необязательны: ТТН не подписывается ЭЦП, заполняем что известно о
// перевозчике, пустое не попадает в документ.
export interface MarketplaceShipmentTTNData {
  /** ФИО экспедитора. */
  expeditor_full_name?: string;
  /** Контактный телефон. */
  expeditor_phone?: string;
  /** Госномер транспортного средства. */
  vehicle_number?: string;
  /** Адрес погрузки (склад поставщика). */
  loading_address?: string;
  /** Дата/время погрузки (ISO). */
  loading_datetime?: string;
  /** Расчётная дата/время доставки на КУ (ISO). */
  delivery_datetime_estimate?: string;
  /** Экспедиторская упаковка по строкам партии (штук в коробке на каждый заказ). */
  packaging?: MarketplaceShipmentLinePackaging[];
}

/**
 * Полный props объект конструктора Shipment'а.
 */
export interface MarketplaceShipmentProps {
  id: string;
  coopname: string;
  /** FK на marketplace_consolidated_request (cycle, к которой принадлежит). */
  cycle_id: string;
  /** Account поставщика (= владелец Offer'ов в группе). */
  offerer_account: string;
  /** КУ-получатель (branch.name = `delivery_braname` исходных Order'ов). */
  braname: string;
  /** Вариант доставки. */
  delivery_variant: MarketplaceShipmentDeliveryVariant;
  /** Сумма quantity * price_per_unit по всем Order'ам группы (numeric → string). */
  total_amount: string;
  /** Уникальный номер ТТН (только для Варианта Б). */
  ttn_number: string | null;
  /** Данные ТТН в форме jsonb (только для Варианта Б). */
  ttn_data: MarketplaceShipmentTTNData | null;
  /** id записи ТТН в локальном реестре marketplace_ttn_document (только для Варианта Б). */
  ttn_document_id: string | null;
  status: MarketplaceShipmentStatus;
  created_at: Date;
  updated_at: Date;
}
