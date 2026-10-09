import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Счёт плана ledger2 в форме GraphQL DTO.
 *
 * id — числовой, со сдвигом ×1000 (51000/80000/86000/...). Суммы —
 * EOSIO-asset строки `"7000.0000 RUB"`.
 */
@ObjectType('Ledger2Account')
export class Ledger2AccountDTO {
  @Field(() => Int, { description: 'ID счёта (×1000 offset): 51000/80000/86000/...' })
  id!: number;

  @Field(() => String, { description: 'Русское название счёта из плана' })
  name!: string;

  @Field(() => String, { description: 'Сальдо (EOSIO asset: "7000.0000 RUB")' })
  balance!: string;

  @Field(() => String, { description: 'Дебетовый оборот' })
  debitBalance!: string;

  @Field(() => String, { description: 'Кредитовый оборот' })
  creditBalance!: string;

  @Field(() => Int, { description: '0 = active (дебетовый), 1 = passive (кредитовый)' })
  accountType!: number;
}
