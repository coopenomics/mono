import type { MarketplaceInventoryDomainEntity } from '../entities/marketplace-inventory.entity';
import type {
  MarketplaceBarcodeFormat,
  MarketplaceInventoryLocation,
  MarketplaceInventoryOwnership,
  MarketplaceInventoryPlacement,
  MarketplaceInventoryStatus,
} from '../entities/marketplace-inventory.types';
import type { MarketplaceUnitOfMeasure } from '../entities/marketplace-offer.types';

export const MARKETPLACE_INVENTORY_REPOSITORY = Symbol('MARKETPLACE_INVENTORY_REPOSITORY');

export interface MarketplaceInventoryCreateInput {
  coopname: string;
  barcode_value?: string | null;
  barcode_format?: MarketplaceBarcodeFormat | null;
  order_id: string;
  shipment_id: string;
  braname: string;
  status: MarketplaceInventoryStatus;
  product_name_snapshot: string;
  quantity_per_label: number;
  orderer_account_snapshot: string;
  shelf?: string | null;
  /** Ячейка хранения, если позиция кладётся на склад напрямую (негабарит). */
  cell_id?: string | null;
  /** Бокс, в который кладётся позиция — основной путь размещения. */
  container_id?: string | null;
  received_at: Date;
  received_by_operator_account: string;
  labeled_at?: Date | null;
  labeled_by_operator_account?: string | null;
  expiry_date?: Date | null;
  /** Принадлежность (requirement 76); дефолт — адресная под заказ (ORDER). */
  ownership?: MarketplaceInventoryOwnership;
  /** Цена прибытия за единицу отпуска (закупочная из акта приёмки). */
  arrival_price?: string | null;
  /**
   * Содержимое упаковки в базовой единице: 0 — отпуск по мере, >0 — упаковкой.
   * Задаёт размерность `arrival_price`, без него сумму позиции не посчитать.
   */
  package_size?: number;
  /** Базовая единица измерения имущества (штука/килограмм/литр). */
  unit_of_measure?: MarketplaceUnitOfMeasure;
}

/** Наложение штрих-кода на существующую позицию (RECEIVED → LABELED). */
export interface MarketplaceInventoryLabelPatch {
  barcode_value: string;
  barcode_format: MarketplaceBarcodeFormat;
  labeled_at: Date;
  labeled_by_operator_account: string;
}

export interface MarketplaceInventoryListFilter {
  coopname: string;
  order_id?: string;
  shipment_id?: string;
  // Массив branames — для ownership-скоупинга оператора по нескольким своим КУ.
  braname?: string | string[];
  status?: MarketplaceInventoryStatus | MarketplaceInventoryStatus[];
  /** requirement 76: фильтр по принадлежности (адресная / обезличенный остаток). */
  ownership?: MarketplaceInventoryOwnership;
  /**
   * Заказ из остатка (stockorder), которому эта позиция была зарезервирована
   * (`reserveStock`/`finalizeReservedIssue` не переносят на позицию `order_id`
   * заказа — только `reserved_order_id`, и не очищают его после выдачи).
   * Нужен для трассировки исходной партии COOP-позиции по заказу остатка.
   */
  reserved_order_id?: string;
  /** Только свободный остаток (reserved_order_id IS NULL). */
  free_only?: boolean;
  /** Только опубликованный (published_offer_id IS NOT NULL) либо только неопубликованный (false). */
  published?: boolean;
  /** Все партии, слитые в конкретный оффер остатка (докладка/витрина). */
  published_offer_id?: string;
}

/**
 * Кандидат на списание: позиция на складе, доступная председателю для
 * ручного сбора корзины проекта списания (admin-стол). Возвращаем ВСЕ позиции
 * на складе — и просроченный скоропорт, и ещё годное имущество: председатель
 * вправе списать вручную и то, что испорчено/не возвращено, а не только то,
 * у чего формально истёк `expiry_date`. `is_expired` отмечает позиции с
 * истёкшим сроком (auto-кандидаты крона) для подсветки в интерфейсе.
 * `arrival_price` — закупочная цена за ЕДИНИЦУ ОТПУСКА из акта приёмки, а
 * `quantity` — в базовой единице. Сумма списания считается только через
 * `calcCostAmount` с `package_size`: при отпуске упаковкой это
 * `quantity / package_size × arrival_price`, перемножать напрямую нельзя.
 */
export interface MarketplaceWriteoffCandidate {
  inventory_id: string;
  braname: string;
  asset_title: string;
  quantity: number;
  arrival_price: string | null;
  /** Фасовка позиции: 0 — по мере, >0 — упаковкой (размерность цены). */
  package_size: number;
  /** Базовая единица измерения позиции (штука/килограмм/литр). */
  unit_of_measure: MarketplaceUnitOfMeasure;
  expiry_date: Date | null;
  is_expired: boolean;
}

export interface MarketplaceInventoryDomainRepository {
  create(input: MarketplaceInventoryCreateInput): Promise<MarketplaceInventoryDomainEntity>;

  findById(id: string): Promise<MarketplaceInventoryDomainEntity | null>;

  findByBarcode(
    coopname: string,
    barcode_value: string
  ): Promise<MarketplaceInventoryDomainEntity | null>;

  countByOrder(coopname: string, order_id: string): Promise<number>;

  /**
   * Сумма фактически принятого и ещё не выданного количества
   * (Σ quantity_per_label по статусам RECEIVED/LABELED) по каждому заказу.
   * Источник истины «сколько можно выдать»: выдача не может превышать
   * физический остаток склада по заказу. Заказы без позиций на складе в
   * карте отсутствуют (трактовать как 0).
   */
  sumOnWarehouseByOrders(coopname: string, order_ids: string[]): Promise<Map<string, number>>;

  /**
   * Места хранения, где лежат не выданные позиции заказа. Лента выдачи
   * показывает оператору, куда идти за имуществом. Заказы без размещённых
   * позиций в карте отсутствуют.
   */
  /**
   * Цена прибытия имущества на складе по заказам — во столько единица
   * обошлась кооперативу при приёмке. От неё считается факт выдачи: пайщик не
   * должен платить за принятое дешевле как за полную цену заказа, иначе
   * выбытие со счёта имущества превышает поступление.
   *
   * Заказы без позиций на складе в карте отсутствуют.
   */
  arrivalPriceOnWarehouseByOrders(coopname: string, order_ids: string[]): Promise<Map<string, string>>;

  locationsOnWarehouseByOrders(
    coopname: string,
    order_ids: string[]
  ): Promise<Map<string, MarketplaceInventoryLocation[]>>;

  list(filter: MarketplaceInventoryListFilter): Promise<MarketplaceInventoryDomainEntity[]>;

  /**
   * Позиции на складе (RECEIVED/LABELED) для ручного сбора корзины списания на
   * admin-столе. Возвращает ВСЁ имущество на складе, а не только просроченное:
   * председатель может списать вручную и годное (порча, невозврат). `cutoff`
   * используется лишь для вычисления флага `is_expired` (expiry_date <= cutoff),
   * не как фильтр. Авто-крон отбирает кандидатов отдельным запросом с
   * grace-периодом и сюда не обращается.
   */
  findWriteoffCandidates(
    coopname: string,
    cutoff: Date
  ): Promise<MarketplaceWriteoffCandidate[]>;

  applyStatusTransition(
    id: string,
    newStatus: MarketplaceInventoryStatus
  ): Promise<MarketplaceInventoryDomainEntity>;

  /**
   * Перевести все позиции склада заказа из «на складе» (RECEIVED/LABELED) в
   * ISSUED при завершении выдачи имущества пайщику. Возвращает число
   * затронутых позиций. Идемпотентно: уже выданные/возвращённые/списанные
   * позиции не трогает.
   */
  markIssuedByOrder(coopname: string, order_id: string): Promise<number>;

  /** Положить позицию в бокс либо в ячейку, или снять с места (обе ссылки пустые). */
  assignPlacement(
    id: string,
    placement: MarketplaceInventoryPlacement
  ): Promise<MarketplaceInventoryDomainEntity>;

  /**
   * Сколько позиций физически лежит в ячейке (статусы «на складе»). Опора
   * гарда «непустую ячейку нельзя вывести из оборота».
   */
  countOnWarehouseByCell(coopname: string, cell_id: string): Promise<number>;

  /**
   * Сколько позиций физически лежит в боксе (статусы «на складе»). Опора
   * гарда «непустой бокс нельзя вывести из оборота».
   */
  countOnWarehouseByContainer(coopname: string, container_id: string): Promise<number>;

  /** Наложить штрих-код и перевести позицию в LABELED. */
  applyLabel(
    id: string,
    patch: MarketplaceInventoryLabelPatch
  ): Promise<MarketplaceInventoryDomainEntity>;

  /** Снять штрих-код и вернуть позицию в RECEIVED (для переклейки). */
  clearLabel(id: string): Promise<MarketplaceInventoryDomainEntity>;

  /** Изменить количество и место позиции (используется при раскладке-split). */
  resize(
    id: string,
    quantity_per_label: number,
    placement: MarketplaceInventoryPlacement
  ): Promise<MarketplaceInventoryDomainEntity>;

  /**
   * Удалить позицию склада. Используется при перераскладке: лишние куски пула
   * заказа схлопываются в одну запись (собрать с полок обратно).
   */
  deleteById(id: string): Promise<void>;

  // ── requirement 76: обезличенный остаток склада КУ ──────────────────

  /**
   * Снять адресность с позиций заказа после финализации выдачи: перевести
   * dелту (всё, что осталось на складе сверх выданного) в обезличенный
   * остаток кооператива. Помечает выданное ISSUED (greedy, со split
   * пограничной позиции), остальное — ownership=COOP. Возвращает
   * количество единиц, ушедших в остаток.
   */
  detachRemainderToStock(
    coopname: string,
    order_id: string,
    issued_quantity: number,
    arrival_price: string | null
  ): Promise<number>;

  /**
   * Зарезервировать свободный опубликованный остаток оффера кооператива под
   * заказ из остатка (FIFO по сроку годности, split пограничной позиции).
   * Бросает, если свободного остатка меньше требуемого.
   */
  reserveStock(
    coopname: string,
    published_offer_id: string,
    quantity: number,
    order_id: string
  ): Promise<void>;

  /** Снять резерв позиций заказа из остатка (отмена/откат докладки). */
  releaseReservation(coopname: string, order_id: string): Promise<number>;

  /**
   * Сумма зарезервированного на складе по заказам из остатка
   * (Σ quantity_per_label по reserved_order_id, статусы на складе) —
   * источник «сколько можно выдать» для гарда выдачи stock-ордеров.
   */
  sumReservedByOrders(coopname: string, order_ids: string[]): Promise<Map<string, number>>;

  /**
   * Выдача по заказу из остатка: перевод зарезервированных позиций в ISSUED
   * (greedy до issued_quantity со split пограничной), невыданный резерв
   * освобождается обратно в свободный остаток (позиция остаётся
   * опубликованной). Возвращает число освобождённых единиц и стоимость
   * выданного по ценам прибытия (для списания уценки o.mkt.loss); у позиций
   * без цены прибытия берётся fallback_arrival_price.
   */
  finalizeReservedIssue(
    coopname: string,
    order_id: string,
    issued_quantity: number,
    fallback_arrival_price: string
  ): Promise<{ released: number; issued_arrival_cost: string }>;

  /** Публикация/снятие с публикации позиций остатка (привязка к офферу кооператива). */
  setPublication(
    coopname: string,
    inventory_ids: string[],
    published_offer_id: string | null
  ): Promise<number>;

  /** Σ свободного опубликованного остатка по офферу кооператива (для счётчиков каталога). */
  sumFreePublishedByOffer(coopname: string, published_offer_id: string): Promise<number>;
}
