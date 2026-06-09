import { Directive, Field, ObjectType } from '@nestjs/graphql';

/**
 * Federation v2 ссылка на core-entity `Cooperative` (кооператив / DC).
 * `username` — EOSIO account name кооператива (например `voskhod`, `partner1`).
 */
@ObjectType('Cooperative')
@Directive('@key(fields: "username")')
export class SharedCooperative {
  @Field(() => String, { description: 'Account name кооператива' })
  @Directive('@external')
  username!: string;
}
