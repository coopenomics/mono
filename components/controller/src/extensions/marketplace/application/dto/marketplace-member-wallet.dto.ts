import { Field, ObjectType } from '@nestjs/graphql';

/**
 * Story 1.5: ссылка marketplace на кошелёк ЦК пайщика.
 *
 * Источник данных — core `WalletService.getProgramWallet` для program_id=1
 * (`ProgramType.MAIN`). Сплит `w.wal.share` + `w.wal.member` ledger2-кошелька
 * сворачивается в один `ProgramWalletDomainEntity` (см.
 * `WalletInteractor.assembleProgramWallets`):
 *
 *   - `available`               — `w.wal.share.available`
 *   - `blocked`                 — `w.wal.share.blocked`
 *   - `membership_contribution` — `w.wal.member.value` (членский вклад)
 *
 * `account_name` = `username` пайщика (логин в Цифровом кооперативе);
 * `contract` = 'wallet'  — фиксированный owner-контракт для main program.
 *
 * Этого набора достаточно фронту `WalletTimeline` (UX-DR8) — баланс + членский
 * вклад. Локальная таблица `marketplace_member_wallet_link` из PRD не
 * заводится: core `WalletService` уже отдаёт данные из синхронизированного
 * `ledger2::userwallets` (PG-кеш). RPC к chain не выполняется.
 */
@ObjectType('MarketplaceMemberWallet')
export class MarketplaceMemberWalletDTO {
  @Field(() => String)
  public readonly username!: string;

  @Field(() => String)
  public readonly coopname!: string;

  @Field(() => String, { description: 'Owner-контракт main program (wallet)' })
  public readonly contract!: string;

  @Field(() => String, { description: 'Доступный остаток (w.wal.share.available)' })
  public readonly available!: string;

  @Field(() => String, { description: 'Заблокированный остаток (w.wal.share.blocked)' })
  public readonly blocked!: string;

  @Field(() => String, {
    description: 'Накопленный членский вклад (w.wal.member.value)',
  })
  public readonly membership_contribution!: string;

  constructor(init: {
    username: string;
    coopname: string;
    contract: string;
    available: string;
    blocked: string;
    membership_contribution: string;
  }) {
    this.username = init.username;
    this.coopname = init.coopname;
    this.contract = init.contract;
    this.available = init.available;
    this.blocked = init.blocked;
    this.membership_contribution = init.membership_contribution;
  }
}
