/**
 * Story 3.1: domain entity витрины. Конфигурация без on-chain — только db.
 */
export class MarketplaceVitrineDomainEntity {
  public readonly id!: string;
  public readonly coopname!: string;
  public readonly display_name!: string;
  public readonly is_default!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  constructor(init: {
    id: string;
    coopname: string;
    display_name: string;
    is_default: boolean;
    created_at: Date;
    updated_at: Date;
  }) {
    this.id = init.id;
    this.coopname = init.coopname;
    this.display_name = init.display_name;
    this.is_default = init.is_default;
    this.created_at = init.created_at;
    this.updated_at = init.updated_at;
  }
}
