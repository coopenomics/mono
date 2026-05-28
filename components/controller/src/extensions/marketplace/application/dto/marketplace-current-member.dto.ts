import { Field, ObjectType } from '@nestjs/graphql';

/**
 * Маркет-контекст текущего пайщика: устанавливается `MarketplaceMembershipGuard`
 * в request/ctx после проверки членства в кооперативе (Story 1.3).
 *
 * `core_roles` — массив core-ролей платформы (`User` / `Member` / `Chairman`).
 * `marketplace_roles` — массив marketplace-специфичных ролей (`buyer`/`supplier`/
 * `recipient`/`treasurer`/`controller`), наполняется в Story 1.6. Сейчас пусто.
 */
@ObjectType('MarketplaceCurrentMember')
export class MarketplaceCurrentMemberDTO {
  @Field(() => String)
  public readonly username!: string;

  @Field(() => [String])
  public readonly core_roles!: string[];

  @Field(() => [String])
  public readonly marketplace_roles!: string[];

  @Field(() => [String], {
    description: 'Кооперативные участки, в которых пайщик — доверенное лицо (для столов оператора ПВЗ)',
  })
  public readonly branches!: string[];

  constructor(init: {
    username: string;
    core_roles: string[];
    marketplace_roles: string[];
    branches: string[];
  }) {
    this.username = init.username;
    this.core_roles = init.core_roles;
    this.marketplace_roles = init.marketplace_roles;
    this.branches = init.branches;
  }
}

export interface IMarketplaceCurrentMember {
  username: string;
  core_roles: string[];
  marketplace_roles: string[];
}
