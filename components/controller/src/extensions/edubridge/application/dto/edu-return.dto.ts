import { Field, Int, ObjectType } from '@nestjs/graphql';
import type { ReturnBalance } from '../services/edubridge-return.service';

/** Что уйдёт в паевой взнос, если выйти из кооператива сегодня. */
@ObjectType('EduReturnBalance')
export class EduReturnBalanceDTO {
  @Field(() => String, { description: 'Остаток кошелька программы' })
  available!: string;

  @Field(() => String, { description: 'Сколько вернут по действующим подпискам, если закрыть их сегодня' })
  refunds!: string;

  @Field(() => String, { description: 'Сколько уйдёт в паевой взнос при выходе из кооператива сегодня' })
  total!: string;

  @Field(() => Int, { description: 'Действующих подписок, которые закроются' })
  subscriptions!: number;

  constructor(b: ReturnBalance) {
    this.available = b.available;
    this.refunds = b.refunds;
    this.total = b.total;
    this.subscriptions = b.subscriptions;
  }
}
