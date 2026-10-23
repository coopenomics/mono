import type {
  MarketplaceConsolidatedRequestStatus,
} from '../../domain/entities/marketplace-consolidated-request.types';

/**
 * Story 4.2: TypeORM-сущность консолидированной заявки. Backend-only
 * (L10) — связь с Order'ами через `marketplace_order.cycle_id = id`.
 *
 * Hot-path индексы:
 *   - `(coopname, supplier_account, status)` — offerer-стол «Консолидированные
 *     заявки» (Story 4.5 supplier accept/decline UI);
 *   - `(coopname, offer_id, status)` — проверка активных партий по офферу;
 *   - `(status, expires_at)` — cron-scan активных Pending по истечению.
 */
export class MarketplaceConsolidatedRequestEntity {
  public id!: string;

  public coopname!: string;

  public offer_id!: string;

  public supplier_account!: string;

  public total_quantity!: number;

  public total_amount!: string;

  public status!: MarketplaceConsolidatedRequestStatus;

  public cycle_started_at!: Date;

  public cycle_ended_at!: Date | null;

  public expires_at!: Date | null;

  public accepted_at!: Date | null;

  public declined_at!: Date | null;

  public decline_reason!: string | null;

  public triggered_by_supplier_at!: Date | null;

  public created_at!: Date;

  public updated_at!: Date;
}
