import type { MarketplaceOrderDomainEntity } from '../entities/marketplace-order.entity';
import type {
  MarketplaceOrderCreateTxSnapshot,
  MarketplaceOrderCycleType,
  MarketplaceOrderStatus,
} from '../entities/marketplace-order.types';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';

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
  price_per_unit: string;
  total_cost: string;
  cycle_type: MarketplaceOrderCycleType;
  cycle_id: string | null;
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
  findByOrderHash(coopname: string, order_hash: string): Promise<MarketplaceOrderDomainEntity | null>;

  list(
    filter: MarketplaceOrderListFilter,
    pagination: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<MarketplaceOrderDomainEntity>>;

  /**
   * Backend-only status transition (например `ACCEPTED → CANCELLED_BY_ORDERER`
   * в Story 4.4, или `ACTIVE → EXPIRED_NO_THRESHOLD` в Story 4.3).
   * Не для блок-стейта on-chain (этим занимается syncer + `updateFromBlockchain`).
   */
  applyStatusTransition(
    id: string,
    newStatus: MarketplaceOrderStatus,
    reason: string | null
  ): Promise<MarketplaceOrderDomainEntity>;

  // ── Story 4.2: cycle-aggregation queries ──────────────────────────

  /**
   * Story 4.2: незаагрегированные ACTIVE Order'ы конкретного Offer'а
   * (cycle_id IS NULL AND status='ACTIVE'). Это «текущий пул» Offer'а
   * для time_based/volume_based/open_subscription cycle_type.
   */
  findUnassignedActiveByOffer(
    coopname: string,
    offer_id: string
  ): Promise<MarketplaceOrderDomainEntity[]>;

  /**
   * Story 4.2: bulk-привязка Order'ов к консолидированной заявке.
   * Используется при формировании консолидированной заявки (time_based
   * cron / volume_based threshold / open_subscription manual trigger).
   * Атомарно меняет status (ACTIVE → ACCEPTED_PENDING_SUPPLIER /
   * ACCEPTED).
   */
  assignToCycle(
    orderIds: string[],
    cycle_id: string,
    newStatus: MarketplaceOrderStatus
  ): Promise<number>;

  /**
   * Story 4.2: сумма quantity активного пула Offer'а (для volume_based
   * threshold check после persist нового Order'а).
   */
  sumUnassignedActiveByOffer(coopname: string, offer_id: string): Promise<number>;
}
