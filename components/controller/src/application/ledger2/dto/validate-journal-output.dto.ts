import { ObjectType, Field, Int, GraphQLISODateTime } from '@nestjs/graphql';

/**
 * Результат проверки инварианта Dr=Cr по журналу ledger2.
 * ok == true, если суммарные дебетовые и кредитовые обороты в выбранном
 * диапазоне совпадают.
 */
@ObjectType('ValidateJournalInvariantResult')
export class ValidateJournalInvariantResultDTO {
  @Field(() => String)
  coopname!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  fromDate?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  toDate?: Date;

  @Field(() => Int, { description: 'Количество записей журнала в диапазоне' })
  entriesCount!: number;

  @Field(() => String, { description: 'Сумма дебетовых оборотов (в минимальных единицах актива)' })
  totalDebit!: string;

  @Field(() => String, { description: 'Сумма кредитовых оборотов (в минимальных единицах актива)' })
  totalCredit!: string;

  @Field(() => String, { description: 'Разница totalDebit - totalCredit (ожидается "0")' })
  difference!: string;

  @Field(() => String, { nullable: true, description: 'Символ актива (обычно RUB), null если диапазон пуст' })
  symbol?: string;

  @Field(() => Boolean, { description: 'true, если инвариант Dr=Cr соблюдён' })
  ok!: boolean;
}
