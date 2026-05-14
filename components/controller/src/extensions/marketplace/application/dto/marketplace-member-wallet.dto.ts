import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Story 1.5: кошельки пайщика на Столе заказов.
 *
 * По стандарту контракта marketplace (см. `marketplace/p.mkt.supply.standard.yaml`,
 * раздел «wallets») в процессах ЦПП «Стол Заказов» у пайщика участвуют три
 * USER_SHARED-кошелька:
 *
 *   1. `w.wal.share`  — ЦПП «Цифровой Кошелёк», паевые взносы деньгами (program_id=1).
 *   2. `w.wal.member` — Универсальный членский кошелёк (program_id=1), играет роль
 *                       транзитного: средства идут share → member → mkt.member.
 *   3. `w.mkt.member` — Программный членский кошелёк ЦПП «Стол Заказов»
 *                       (program_id=2), формируется при первом orderoffer/createorder.
 *
 * Источник балансов — core `UserWalletRepository.findByUsername` (PG-кеш
 * `ledger2::userwallets`); RPC к chain не выполняется (ADR-011). Каждый
 * кошелёк отдаётся «как есть» — `available` и `blocked` напрямую из L3,
 * без сворачивания/переименования. Если L3-записи ещё нет (пайщик не
 * двигал средства через данный кошелёк) — возвращаем `0/0`.
 *
 * Платформенный кошелёк `w.mkt.payout` (COOPERATIVE, не per-user) сюда не
 * включается — это кошелёк выплат поставщикам, отображается в admin-вьюхе
 * кооператива.
 */
@ObjectType('MarketplaceWalletEntry')
export class MarketplaceWalletEntryDTO {
  @Field(() => String, { description: 'eosio::name кошелька (w.wal.share / w.wal.member / w.mkt.member)' })
  public readonly name!: string;

  @Field(() => String, { description: 'Человекочитаемое название (из cooptypes LEDGER2_WALLET_REGISTRY)' })
  public readonly human_name!: string;

  @Field(() => Int, { description: 'program_id: 1 — Цифровой Кошелёк, 2 — Стол Заказов' })
  public readonly program_id!: number;

  @Field(() => String, {
    description:
      'UX-метка кошелька в формате `<тип взноса> | <программа>` (например «Паевой | Цифровой Кошелёк», «Членский | Стол Заказов»)',
  })
  public readonly label!: string;

  @Field(() => String, { description: 'WalletKind: USER_SHARED — обязателен L3-разрез по пайщику' })
  public readonly kind!: string;

  @Field(() => String, { description: 'Доступный остаток (`userwallets.available`)' })
  public readonly available!: string;

  @Field(() => String, { description: 'Заблокированный остаток (`userwallets.blocked`)' })
  public readonly blocked!: string;

  constructor(init: {
    name: string;
    human_name: string;
    program_id: number;
    label: string;
    kind: string;
    available: string;
    blocked: string;
  }) {
    this.name = init.name;
    this.human_name = init.human_name;
    this.program_id = init.program_id;
    this.label = init.label;
    this.kind = init.kind;
    this.available = init.available;
    this.blocked = init.blocked;
  }
}

@ObjectType('MarketplaceMemberWallet')
export class MarketplaceMemberWalletDTO {
  @Field(() => String)
  public readonly username!: string;

  @Field(() => String)
  public readonly coopname!: string;

  @Field(() => [MarketplaceWalletEntryDTO], {
    description: 'Релевантные стол-заказам USER_SHARED-кошельки пайщика; порядок: share → member → mkt.member',
  })
  public readonly wallets!: MarketplaceWalletEntryDTO[];

  constructor(init: { username: string; coopname: string; wallets: MarketplaceWalletEntryDTO[] }) {
    this.username = init.username;
    this.coopname = init.coopname;
    this.wallets = init.wallets;
  }
}
