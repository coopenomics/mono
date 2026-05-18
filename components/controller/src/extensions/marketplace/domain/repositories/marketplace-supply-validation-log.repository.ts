import type { MarketplaceSupplyValidationLogDomainEntity } from '../entities/marketplace-supply-validation-log.entity';
import type {
  MarketplaceSupplyValidationOutcome,
  MarketplaceSupplyValidationReason,
} from '../entities/marketplace-supply-validation-log.types';

export const MARKETPLACE_SUPPLY_VALIDATION_LOG_REPOSITORY = Symbol(
  'MARKETPLACE_SUPPLY_VALIDATION_LOG_REPOSITORY'
);

export interface MarketplaceSupplyValidationLogCreateInput {
  coopname: string;
  cycle_id: string;
  offerer_account: string;
  outcome: MarketplaceSupplyValidationOutcome;
  reason: string | null;
  reason_code: MarketplaceSupplyValidationReason | null;
  attempted_groups: unknown;
}

export interface MarketplaceSupplyValidationLogDomainRepository {
  create(
    input: MarketplaceSupplyValidationLogCreateInput
  ): Promise<MarketplaceSupplyValidationLogDomainEntity>;

  findByCycleId(
    coopname: string,
    cycle_id: string
  ): Promise<MarketplaceSupplyValidationLogDomainEntity[]>;
}
