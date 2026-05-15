export type MarketplaceWhitelistRole = 'auto-coop' | 'manual';

/**
 * Story 3.1: domain entity записи whitelist. Конфигурация без on-chain.
 */
export class MarketplaceWhitelistEntryDomainEntity {
  public readonly id!: string;
  public readonly coopname!: string;
  public readonly member_account!: string;
  public readonly role!: MarketplaceWhitelistRole;
  public readonly added_by!: string | null;
  public readonly added_at!: Date;

  constructor(init: {
    id: string;
    coopname: string;
    member_account: string;
    role: MarketplaceWhitelistRole;
    added_by: string | null;
    added_at: Date;
  }) {
    this.id = init.id;
    this.coopname = init.coopname;
    this.member_account = init.member_account;
    this.role = init.role;
    this.added_by = init.added_by;
    this.added_at = init.added_at;
  }
}
