import type {
  MarketplaceSupplyValidationOutcome,
  MarketplaceSupplyValidationReason,
} from '../../domain/entities/marketplace-supply-validation-log.types';

/**
 * Story 5.2: журнал валидаций состава поставки. Append-only для аудита.
 */
export class MarketplaceSupplyValidationLogEntity {
  public id!: string;

  public coopname!: string;

  public cycle_id!: string;

  public offerer_account!: string;

  public outcome!: MarketplaceSupplyValidationOutcome;

  public reason!: string | null;

  public reason_code!: MarketplaceSupplyValidationReason | null;

  public attempted_groups!: unknown;

  public created_at!: Date;
}
