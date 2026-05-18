import type {
  MarketplaceSupplyValidationLogProps,
  MarketplaceSupplyValidationOutcome,
  MarketplaceSupplyValidationReason,
} from './marketplace-supply-validation-log.types';

/**
 * Story 5.2: запись журнала валидации состава поставки. Immutable после
 * вставки.
 */
export class MarketplaceSupplyValidationLogDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly cycle_id: string;
  public readonly offerer_account: string;
  public readonly outcome: MarketplaceSupplyValidationOutcome;
  public readonly reason: string | null;
  public readonly reason_code: MarketplaceSupplyValidationReason | null;
  public readonly attempted_groups: unknown;
  public readonly created_at: Date;

  constructor(props: MarketplaceSupplyValidationLogProps) {
    this.id = props.id;
    this.coopname = props.coopname;
    this.cycle_id = props.cycle_id;
    this.offerer_account = props.offerer_account;
    this.outcome = props.outcome;
    this.reason = props.reason;
    this.reason_code = props.reason_code;
    this.attempted_groups = props.attempted_groups;
    this.created_at = props.created_at;
  }
}
