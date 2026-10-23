
/**
 * Story 3.3: журнал решений модерации Offer'ов. Append-only.
 */
export class MarketplaceModerationLogEntity {
  public id!: string;

  public offer_id!: string;

  public action!: 'approve' | 'reject' | 'set_warranty';

  public by_account!: string;

  public reason!: string | null;

  public created_at!: Date;
}
