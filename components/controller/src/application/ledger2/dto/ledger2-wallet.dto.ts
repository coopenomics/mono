import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Общекооперативный кошелёк ledger2 (1001/2001/3001/4001...).
 * Кошельки пайщиков живут в контракте soviet — они сюда не попадают.
 */
@ObjectType('Ledger2Wallet')
export class Ledger2WalletDTO {
  @Field(() => Int, { description: 'ID кошелька (×1000 offset): 1001/2001/3001/4001' })
  id!: number;

  @Field(() => String, { description: 'Название кошелька' })
  name!: string;

  @Field(() => String, { description: 'Доступный баланс' })
  available!: string;

  @Field(() => String, { description: 'Заблокированный баланс' })
  blocked!: string;
}
