import { Field, Float, ObjectType } from '@nestjs/graphql';

/** Итог смены тарифа сервера: перенос запущен, цена уже действует. */
@ObjectType('ChangeHostingPlanResult')
export class ChangeHostingPlanResultDTO {
  @Field(() => String, { description: 'Состояние запущенного переноса (renting, …)' })
  migration_state!: string;

  @Field(() => Float, { description: 'Новая цена за период, применена немедленно' })
  new_price!: number;
}
