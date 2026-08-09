import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Кошелёк пайщика «как есть» — одна строка `ledger2::userwallets` без
 * сворачивания share+member в одно число. В отличие от `ProgramWallet`
 * (срез по программе), отдаёт каждый кошелёк отдельно по его идентификатору,
 * чтобы UI мог показывать паевой / членский / программные кошельки раздельно.
 */
@ObjectType('UserWallet')
export class UserWalletDTO {
  @Field(() => ID, { description: 'Идентификатор записи кошелька' })
  id!: string;

  @Field(() => String, { description: 'Имя кооператива' })
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор кошелька' })
  wallet_name!: string;

  @Field(() => String, { description: 'Человекочитаемое название кошелька' })
  human_name!: string;

  @Field(() => ID, { nullable: true, description: 'Идентификатор программы кошелька' })
  program_id?: string | null;

  @Field(() => String, { description: 'Имя пользователя' })
  username!: string;

  @Field(() => String, { description: 'Доступный остаток (формат: "100.0000 RUB")' })
  available!: string;

  @Field(() => String, { description: 'Заблокированный остаток (формат: "0.0000 RUB")' })
  blocked!: string;
}
