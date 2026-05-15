import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('MarketplaceWhitelistEntry')
export class MarketplaceWhitelistEntryDTO {
  @Field(() => String, { description: 'UUID записи whitelist' })
  public readonly id!: string;

  @Field(() => String, { description: 'eosio::name кооператива' })
  public readonly cooperative_id!: string;

  @Field(() => String, { description: 'eosio::name пайщика-поставщика' })
  public readonly member_account!: string;

  @Field(() => String, {
    description:
      'auto-coop — сам кооператив (неудаляема, FR5); manual — добавлен админом',
  })
  public readonly role!: string;

  @Field(() => String, { nullable: true, description: 'Кто добавил (eosio::name админа)' })
  public readonly added_by!: string | null;

  @Field(() => Date)
  public readonly added_at!: Date;

  constructor(init: {
    id: string;
    cooperative_id: string;
    member_account: string;
    role: string;
    added_by: string | null;
    added_at: Date;
  }) {
    this.id = init.id;
    this.cooperative_id = init.cooperative_id;
    this.member_account = init.member_account;
    this.role = init.role;
    this.added_by = init.added_by;
    this.added_at = init.added_at;
  }
}
