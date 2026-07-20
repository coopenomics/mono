import type { MarketplaceInventoryDomainEntity } from '../entities/marketplace-inventory.entity';
import type {
  MarketplaceBarcodeFormat,
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
}
