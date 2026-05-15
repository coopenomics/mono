import type { MarketplaceConsolidatedRequestDomainEntity } from '../entities/marketplace-consolidated-request.entity';
import type {
  MarketplaceConsolidatedRequestStatus,
} from '../entities/marketplace-consolidated-request.types';
import type { MarketplaceOrderCycleType } from '../entities/marketplace-order.types';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';

export const MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY = Symbol(
  'MARKETPLACE_CONSOLIDATED_REQUEST_REPOSITORY'
);

export interface MarketplaceConsolidatedRequestCreateInput {
  coopname: string;
  offer_id: string;
  supplier_account: string;
  cycle_type: MarketplaceOrderCycleType;
  total_quantity: number;
  total_amount: string;
  status: MarketplaceConsolidatedRequestStatus;
  cycle_started_at: Date;
  cycle_ended_at: Date | null;
  expires_at: Date | null;
  triggered_by_supplier_at: Date | null;
}

export interface MarketplaceConsolidatedRequestListFilter {
  coopname: string;
  offer_id?: string;
  supplier_account?: string;
  status?: MarketplaceConsolidatedRequestStatus | MarketplaceConsolidatedRequestStatus[];
  cycle_type?: MarketplaceOrderCycleType;
}

export interface MarketplaceConsolidatedRequestDomainRepository {
  create(
    input: MarketplaceConsolidatedRequestCreateInput
  ): Promise<MarketplaceConsolidatedRequestDomainEntity>;

  findById(id: string): Promise<MarketplaceConsolidatedRequestDomainEntity | null>;

  /**
   * Активные time_based циклы у которых `cycle_ended_at < now` — кандидаты
   * на закрытие cron'ом (Story 4.2 / Story 4.3).
   */
  findExpiredTimeBased(now: Date): Promise<MarketplaceConsolidatedRequestDomainEntity[]>;

  /**
   * Активные volume_based заявки + параллельно volume-based Order'ы которые
   * висят в `ACTIVE` за пределом `max_wait_days` (Story 4.3 cleanup).
   */
  findExpiredAwaitingResponse(now: Date): Promise<MarketplaceConsolidatedRequestDomainEntity[]>;

  list(
    filter: MarketplaceConsolidatedRequestListFilter,
    pagination: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<MarketplaceConsolidatedRequestDomainEntity>>;

  applyStatusTransition(
    id: string,
    newStatus: MarketplaceConsolidatedRequestStatus,
    options?: { decline_reason?: string | null }
  ): Promise<MarketplaceConsolidatedRequestDomainEntity>;
}
