import type {
  MarketplaceModerationLogDomainEntity,
  MarketplaceModerationAction,
} from '../entities/marketplace-moderation-log.entity';

export const MARKETPLACE_MODERATION_LOG_REPOSITORY = Symbol('MARKETPLACE_MODERATION_LOG_REPOSITORY');

export interface MarketplaceModerationLogDomainRepository {
  append(input: {
    offer_id: string;
    action: MarketplaceModerationAction;
    by_account: string;
    reason: string | null;
  }): Promise<MarketplaceModerationLogDomainEntity>;
  listByOffer(offer_id: string): Promise<MarketplaceModerationLogDomainEntity[]>;
}
