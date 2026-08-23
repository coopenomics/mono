import type { MarketplaceStockProposalDomainEntity } from '../entities/marketplace-stock-proposal.entity';
import type {
  MarketplaceStockProposalItem,
  MarketplaceStockProposalStatus,
} from '../entities/marketplace-stock-proposal.types';

export const MARKETPLACE_STOCK_PROPOSAL_REPOSITORY = Symbol('MARKETPLACE_STOCK_PROPOSAL_REPOSITORY');

export interface MarketplaceStockProposalCreateInput {
  coopname: string;
  braname: string;
  member_account: string;
  operator_account: string;
  items: MarketplaceStockProposalItem[];
}

export interface MarketplaceStockProposalListFilter {
  coopname: string;
  member_account?: string;
  braname?: string | string[];
  status?: MarketplaceStockProposalStatus | MarketplaceStockProposalStatus[];
}

export interface MarketplaceStockProposalDomainRepository {
  create(input: MarketplaceStockProposalCreateInput): Promise<MarketplaceStockProposalDomainEntity>;

  findById(id: string): Promise<MarketplaceStockProposalDomainEntity | null>;

  list(filter: MarketplaceStockProposalListFilter): Promise<MarketplaceStockProposalDomainEntity[]>;

  /**
   * Перевод статуса с CAS-гардом на текущий статус (двойной акцепт/отзыв при
   * гонке оператор-пайщик не пройдёт: 0 affected → null).
   */
  applyResolution(
    id: string,
    from_status: MarketplaceStockProposalStatus,
    to_status: MarketplaceStockProposalStatus,
    created_order_ids?: string[]
  ): Promise<MarketplaceStockProposalDomainEntity | null>;
}
