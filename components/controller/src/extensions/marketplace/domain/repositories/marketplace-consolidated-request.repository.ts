import type { MarketplaceConsolidatedRequestDomainEntity } from '../entities/marketplace-consolidated-request.entity';
import type {
  MarketplaceConsolidatedRequestStatus,
} from '../entities/marketplace-consolidated-request.types';
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
}

export interface MarketplaceConsolidatedRequestDomainRepository {
  create(
    input: MarketplaceConsolidatedRequestCreateInput
  ): Promise<MarketplaceConsolidatedRequestDomainEntity>;

  findById(id: string): Promise<MarketplaceConsolidatedRequestDomainEntity | null>;

  /**
   * Сводные заявки в `PENDING_SUPPLIER_ACCEPT` с истёкшим acceptance-окном
   * (`expires_at < now`) — поставщик не ответил, кандидаты на авто-отмену
   * пула (cron `expireUnacceptedPending`).
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
