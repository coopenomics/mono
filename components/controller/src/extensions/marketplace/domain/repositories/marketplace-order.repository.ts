import type { MarketplaceOrderDomainEntity } from '../entities/marketplace-order.entity';
import type {
  MarketplaceOrderCreateTxSnapshot,
  MarketplaceOrderIssuanceFactSnapshot,
  MarketplaceOrderStatus,
} from '../entities/marketplace-order.types';
import type { MarketplaceUnitOfMeasure } from '../entities/marketplace-offer.types';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

export const MARKETPLACE_ORDER_REPOSITORY = Symbol('MARKETPLACE_ORDER_REPOSITORY');

export interface MarketplaceOrderCreateInput {
  coopname: string;
  order_hash: string;
  orderer_account: string;
  offer_id: string;
  offer_hash: string;
  supplier_account: string;
  delivery_braname: string;
  quantity: number;
  unit_of_measure: MarketplaceUnitOfMeasure;
  price_per_unit: string;
  /** Содержимое упаковки в базовой единице (Эпик 18); 0 = отпуск по мере. */
  package_size: number;
  total_cost: string;
  cycle_id: string | null;
  /** Грань «заказ заказчика» (Эпик 16): общий id строк одного оформления на один КУ. */
  checkout_id: string | null;
  warranty_period_secs: number;
  warranty_until: Date | null;
  status: MarketplaceOrderStatus;
  blocked_at: Date | null;
  create_tx: MarketplaceOrderCreateTxSnapshot | null;
}

export interface MarketplaceOrderListFilter {
  coopname: string;
  orderer_account?: string;
  supplier_account?: string;
  offer_id?: string;
  status?: MarketplaceOrderStatus | MarketplaceOrderStatus[];
  cycle_id?: string;
  /** Грань «заказ заказчика» (Эпик 16): фильтр строк одного оформления. */
  checkout_id?: string;
  /** ПВЗ доставки заказа (Story 14.2: express-приёмка ACCEPTED-заказов на КУ). */
  delivery_braname?: string;
}

/**
 * Story 4.1: репозиторий Order'а Стола заказов. Расширяет
 * `IBlockchainSyncRepository` для интеграции с `AbstractEntitySyncService`
 * (методы `findBySyncKey` / `findByBlockNumGreaterThan` /
 * `deleteByBlockNumGreaterThan` наследуются по контракту kernel'а).
 */
export interface MarketplaceOrderDomainRepository
  extends IBlockchainSyncRepository<MarketplaceOrderDomainEntity> {
  // ── Backend create-flow (Story 4.1: после успешного on-chain submit) ──

  /**
   * Создаёт PG row Order'а после успешного on-chain submit `createorder`
   * через ledger2. Side-by-side с `IBlockchainSyncRepository.create(entity)` —
   * это backend-инициируемый create (не от syncer'а), потому отдельное имя.
   */
  persistAfterBlock(input: MarketplaceOrderCreateInput): Promise<MarketplaceOrderDomainEntity>;
  findById(id: string): Promise<MarketplaceOrderDomainEntity | null>;
  /** Батч-выборка заказов по идентификаторам (для обогащения позиций приёмки). */
  findByIds(ids: string[]): Promise<MarketplaceOrderDomainEntity[]>;
  findByOrderHash(coopname: string, order_hash: string): Promise<MarketplaceOrderDomainEntity | null>;
  /**
   * Батч-выборка заказов по хэшам процессов — движения кошелька участка знают
   * заказ только по хэшу процесса поставки, а ссылка ведёт на страницу заказа
   * по его идентификатору.
   */
  findByOrderHashes(coopname: string, order_hashes: string[]): Promise<MarketplaceOrderDomainEntity[]>;

  /**
   * Заказы, включённые в конкретную партию (резолв состава партии на приёмке).
   * Заменяет инференс «по (cycle, КУ)» — обязателен при нескольких частичных
   * партиях на одном КУ.
   */
  findByShipmentId(coopname: string, shipment_id: string): Promise<MarketplaceOrderDomainEntity[]>;

  /**
   * Привязать заказы к сформированной партии + перевести ACCEPTED → SUPPLY_PREPARED
   * одним bulk-апдейтом. Затрагивает ТОЛЬКО заказы в статусе ACCEPTED без партии
   * (`shipment_id IS NULL`) — guard от двойного включения в две партии.
   * Возвращает число реально привязанных заказов.
   */
  assignToShipment(orderIds: string[], shipment_id: string, reason: string | null): Promise<number>;

  list(
    filter: MarketplaceOrderListFilter,
    pagination: PaginationInputDTO
  ): Promise<PaginationResult<MarketplaceOrderDomainEntity>>;

  /**
   * Backend-only status transition (например `ACCEPTED → CANCELLED_BY_ORDERER`,
   * или `ACTIVE → CANCELLED_BY_SUPPLIER`). Не для блок-стейта on-chain
   * (этим занимается syncer + `updateFromBlockchain`).
   */
  applyStatusTransition(
    id: string,
    newStatus: MarketplaceOrderStatus,
    reason: string | null
  ): Promise<MarketplaceOrderDomainEntity>;

  // ── Агрегация коллективной закупки ────────────────────────────────

  /**
   * Незаагрегированные ACTIVE Order'ы конкретного Offer'а
   * (cycle_id IS NULL AND status='ACTIVE') — «текущий пул» коллективной
   * закупки.
   */
  findUnassignedActiveByOffer(
    coopname: string,
    offer_id: string
  ): Promise<MarketplaceOrderDomainEntity[]>;

  /**
   * Bulk-привязка Order'ов к сводной заявке партии. Используется при
   * формировании заявки (авто-сбор по целевому объёму / ручной запуск
   * поставщика). Атомарно меняет status (ACTIVE → ACCEPTED_PENDING_SUPPLIER /
   * ACCEPTED).
   */
  assignToCycle(
    orderIds: string[],
    cycle_id: string,
    newStatus: MarketplaceOrderStatus
  ): Promise<number>;

  /**
   * Сумма quantity активного пула Offer'а (для проверки достижения целевого
   * объёма после persist нового Order'а).
   */
  sumUnassignedActiveByOffer(coopname: string, offer_id: string): Promise<number>;

  /**
   * Батч «сколько накоплено» по парам (offer × КУ) на этапе сбора: сумма
   * quantity всех ACTIVE-заказов (всех пайщиков) каждого предложения в разрезе
   * ПВЗ доставки. Нужен, чтобы заказчик в своей ленте видел коллективный
   * прогресс сбора партии (а не только свой вклад). Результат — строки
   * (offer_id, delivery_braname, total).
   */
  sumActiveByOfferBranch(
    coopname: string,
    offerIds: string[]
  ): Promise<Array<{ offer_id: string; delivery_braname: string; total: number }>>;

  /**
   * Сумма quantity по сформированным партиям (cycle_id) — всех пайщиков. Нужна,
   * чтобы заказчик видел коллективный объём уже принятой партии тем же
   * прогрессом, что и у партии на этапе сбора (единый вид карточки на ленте
   * коллективного заказа). Результат — строки (cycle_id, total).
   */
  sumByCycleIds(
    coopname: string,
    cycleIds: string[]
  ): Promise<Array<{ cycle_id: string; total: number }>>;

  /**
   * Story 4.3: все Order'ы, привязанные к заявке `cycle_id`. Используется
   * cron'ом expireUnacceptedPending для per-Order unblk пулу заявки,
   * у которой истёк `expires_at` без ответа поставщика.
   */
  findByCycleId(coopname: string, cycle_id: string): Promise<MarketplaceOrderDomainEntity[]>;

  // ── Story 6.1 / 6.3: выдача пайщику на КУ ─────────────────────────

  /**
   * Паевая модель: оператор отметил поступление имущества на участок выдачи
   * (`readyissue`). ACCEPTED_TO_COOP → READY_TO_RECEIVE, `current_warehouse_braname`
   * = участок выдачи, `ready_announced_at = now()` (момент, когда заказчику
   * ушло «приходите»).
   */
  applyReadyIssue(id: string, patch: { current_warehouse_braname: string }): Promise<MarketplaceOrderDomainEntity>;

  /**
   * Заказчик подписал заявление о возврате паевого взноса имуществом
   * (`issuestmt`): READY_TO_RECEIVE → ISSUE_PENDING, факт закреплён.
   */
  applyIssuanceStatement(
    id: string,
    patch: { issuance_fact: MarketplaceOrderIssuanceFactSnapshot }
  ): Promise<MarketplaceOrderDomainEntity>;

  /** Решение совета получено (`onmktisauth`): ISSUE_PENDING → ISSUE_AUTHORIZED, номер решения. */
  applyIssuanceAuthorized(id: string, patch: { issue_decision_id: string | null }): Promise<MarketplaceOrderDomainEntity>;

  /** Первая подпись акта заказчиком (`issueact1`): ISSUE_AUTHORIZED → ISSUE_ACT1. */
  applyIssuanceAct1(id: string): Promise<MarketplaceOrderDomainEntity>;

  /**
   * Закрывающая подпись акта председателем участка (`issueact2`):
   * ISSUE_ACT1 → RECEIVED, гарантийное окно, сторона кооператива, tx.
   */
  applyIssuanceClosed(
    id: string,
    patch: {
      delivery_signer_account: string;
      issue_closed_tx_hash: string;
      issuance_fact: MarketplaceOrderIssuanceFactSnapshot;
      warranty_until: Date | null;
    }
  ): Promise<MarketplaceOrderDomainEntity>;

  /**
   * Отказ совета или отмена выдачи оператором: обратно в READY_TO_RECEIVE,
   * факт и номер решения снимаются.
   */
  applyIssuanceReset(id: string): Promise<MarketplaceOrderDomainEntity>;

  /**
   * Ленты выдачи для стола оператора: заказы от приёма кооперативом до
   * закрытия выдачи (ACCEPTED_TO_COOP, READY_TO_RECEIVE, ISSUE_*) по КУ выдачи.
   */
  listForIssuanceByBraname(
    coopname: string,
    delivery_braname: string
  ): Promise<MarketplaceOrderDomainEntity[]>;
}
