import { Field, ObjectType } from '@nestjs/graphql';

/**
 * Общекооперативный кошелёк ledger2.
 * Кошельки пайщиков живут в контракте soviet — они сюда не попадают.
 *
 * `id` — eosio::name-идентификатор `w.<contract>.<waltype>` (например
 * `w.wal.share`, `w.cap.bginv`). См. `cooptypes/ledger2/wallets.ts`.
 */
@ObjectType('Ledger2Wallet')
export class Ledger2WalletDTO {
  @Field(() => String, { description: 'eosio::name-идентификатор кошелька (w.<contract>.<waltype>)' })
  id!: string;

  @Field(() => String, { description: 'Название кошелька' })
  name!: string;

  @Field(() => String, { description: 'Доступный баланс' })
  available!: string;

  @Field(() => String, { description: 'Заблокированный баланс' })
  blocked!: string;
}
