import type { MarketplaceInventoryDomainEntity } from '../entities/marketplace-inventory.entity';
import type {
  MarketplaceBarcodeFormat,
  MarketplaceInventoryOwnership,
  MarketplaceInventoryStatus,
} from '../entities/marketplace-inventory.types';

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
  received_at: Date;
  received_by_operator_account: string;
  labeled_at?: Date | null;
  labeled_by_operator_account?: string | null;
  expiry_date?: Date | null;
  /** Принадлежность (requirement 76); дефолт — адресная под заказ (ORDER). */
  ownership?: MarketplaceInventoryOwnership;
  /** Цена прибытия за единицу (закупочная из акта приёмки). */
  arrival_price?: string | null;
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
  /** Только свободный остаток (reserved_order_id IS NULL). */
  free_only?: boolean;
  /** Только опубликованный (published_offer_id IS NOT NULL) либо только неопубликованный (false). */
  published?: boolean;
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
   * Полки склада, на которых лежат не выданные позиции заказа (после
   * раскладки/маркировки). Лента выдачи показывает оператору, куда идти
   * за имуществом. Заказы без размеченных полок в карте отсутствуют.
   */
  shelvesOnWarehouseByOrders(
    coopname: string,
    order_ids: string[]
  ): Promise<Map<string, string[]>>;

  list(filter: MarketplaceInventoryListFilter): Promise<MarketplaceInventoryDomainEntity[]>;

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

  /** Назначить/сменить/очистить полку склада для позиции. */
  assignShelf(id: string, shelf: string | null): Promise<MarketplaceInventoryDomainEntity>;

  /** Наложить штрих-код и перевести позицию в LABELED. */
  applyLabel(
    id: string,
    patch: MarketplaceInventoryLabelPatch
  ): Promise<MarketplaceInventoryDomainEntity>;

  /** Снять штрих-код и вернуть позицию в RECEIVED (для переклейки). */
  clearLabel(id: string): Promise<MarketplaceInventoryDomainEntity>;

  /** Изменить количество и полку позиции (используется при раскладке-split). */
  resize(
    id: string,
    quantity_per_label: number,
    shelf: string | null
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
