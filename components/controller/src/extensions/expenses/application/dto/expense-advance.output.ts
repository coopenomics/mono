import { Field, ObjectType } from '@nestjs/graphql';
import { ExpenseAdvanceState } from '../../domain/enums/expense-advance-state.enum';

/** Выданный аванс под отчёт — строка служебной записки на пайщика. */
@ObjectType('ExpenseAdvance', { description: 'Выданный аванс под отчёт.' })
export class ExpenseAdvanceOutputDTO {
  @Field(() => String, { description: 'Хеш служебной записки.' })
  proposal_hash!: string;

  @Field(() => String, { description: 'Хеш строки-аванса.' })
  item_hash!: string;

  @Field(() => String, { description: 'Получатель аванса (учётное имя пайщика).' })
  recipient!: string;

  @Field(() => String, { description: 'ФИО получателя аванса.' })
  recipient_name!: string;

  @Field(() => String, { description: 'Назначение аванса — описание строки служебной записки.' })
  description!: string;

  @Field(() => String, { description: 'Сумма аванса.' })
  advance_amount!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фактически потрачено по отчёту получателя; пусто, пока отчёта нет.',
  })
  spent_amount?: string | null;

  @Field(() => ExpenseAdvanceState, { description: 'Состояние аванса.' })
  state!: ExpenseAdvanceState;

  @Field(() => Date, { nullable: true, description: 'Дата выдачи аванса.' })
  issued_at?: Date | null;
}
