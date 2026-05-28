import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Кошельки пайщика на Столе заказов.
 *
 * По стандарту контракта marketplace (см. `marketplace/p.mkt.supply.standard.yaml`,
 * раздел «wallets») в процессах ЦПП «Стол Заказов» у пайщика участвуют три
 * USER_SHARED-кошелька:
 *
 *   1. `w.wal.share`  — ЦПП «Цифровой Кошелёк», паевые взносы деньгами (program_id=1).
 *   2. `w.wal.member` — Универсальный членский кошелёк (program_id=1). Источник
 *                       средств при createorder и приёмник при возврате (отмена/
 *                       снятие резерва при signiss2 с актуал < ordered).
 *   3. `w.mkt.order`  — Резерв средств пайщика под конкретный Order (program_id=2).
 *                       Сюда движутся средства на createorder (TRANSFER из
 *                       w.wal.member), обратно — на cancel/decline/expire.
 *                       Сжигается BURN'ом на signiss2 (выдача имущества).
 *
 * Источник балансов — core `UserWalletRepository.findByUsername` (PG-кеш
 * `ledger2::userwallets`); RPC к chain не выполняется (ADR-011). Каждый
 * кошелёк отдаётся «как есть» — `available` и `blocked` напрямую из L3,
 * без сворачивания/переименования. Если L3-записи ещё нет (пайщик не
 * двигал средства через данный кошелёк) — возвращаем `0/0`. Поле `blocked`
 * для marketplace-кошельков всегда `0` после миграции с BLOCK/UNBLOCK на
 * пары TRANSFER (2026-05-28) — резерв выражается через .available
 * отдельного кошелька w.mkt.order.
 *
 * Платформенный кошелёк `w.mkt.payout` (COOPERATIVE, не per-user) сюда не
 * включается — это кошелёк выплат поставщикам, отображается в admin-вьюхе
 * кооператива.
 */
@ObjectType('MarketplaceWalletEntry')
export class MarketplaceWalletEntryDTO {
  @Field(() => String, { description: 'eosio::name кошелька (w.wal.share / w.wal.member / w.mkt.order)' })
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

  @Field(() => String, {
    description:
      'Заблокированный остаток (`userwallets.blocked`). Для marketplace-кошельков всегда `0` — резерв выражается через `.available` кошелька w.mkt.order. Поле остаётся для wallet/withdraw flow и legacy данных.',
  })
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
    description: 'Релевантные стол-заказам USER_SHARED-кошельки пайщика; порядок: share → member → mkt.order',
  })
  public readonly wallets!: MarketplaceWalletEntryDTO[];

  constructor(init: { username: string; coopname: string; wallets: MarketplaceWalletEntryDTO[] }) {
    this.username = init.username;
    this.coopname = init.coopname;
    this.wallets = init.wallets;
  }
}
