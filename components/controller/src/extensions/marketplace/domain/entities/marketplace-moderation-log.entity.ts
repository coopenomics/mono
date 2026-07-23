/**
 * Story 3.3: domain entity записи журнала модерации.
 * Append-only, без обновления.
 */
export type MarketplaceModerationAction = 'approve' | 'reject' | 'set_warranty';

export class MarketplaceModerationLogDomainEntity {
  public readonly id!: string;
  public readonly offer_id!: string;
  public readonly action!: MarketplaceModerationAction;
  public readonly by_account!: string;
  public readonly reason!: string | null;
  public readonly created_at!: Date;

  constructor(init: {
    id: string;
    offer_id: string;
    action: MarketplaceModerationAction;
    by_account: string;
    reason: string | null;
    created_at: Date;
  }) {
    Object.assign(this, init);
  }
}
