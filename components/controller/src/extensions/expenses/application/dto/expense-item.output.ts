import { Field, ObjectType } from '@nestjs/graphql';
import { ExpenseItemStatus } from '../../domain/enums/expense-item-status.enum';
import { ExpenseMechanics } from '../../domain/enums/expense-mechanics.enum';
import { ExpenseRecipientType } from '../../domain/enums/expense-recipient-type.enum';

/**
 * Output DTO строки СЗ-расхода. Зеркалит `IExpenseItemBlockchainData`.
 */
@ObjectType('ExpenseItem', { description: 'Строка сметы расхода.' })
export class ExpenseItemOutputDTO {
  @Field(() => String, { description: 'Хеш строки расхода.' })
  item_hash!: string;

  @Field(() => ExpenseMechanics, { description: 'Способ оплаты.' })
  mechanics!: ExpenseMechanics;

  @Field(() => ExpenseRecipientType, { description: 'Тип получателя платежа.' })
  recipient_type!: ExpenseRecipientType;

  @Field(() => String, { nullable: true, description: 'Идентификатор получателя.' })
  recipient?: string;

  @Field(() => String, { description: 'Назначение/описание строки.' })
  description!: string;

  @Field(() => String, { description: 'Планируемая сумма.' })
  planned_amount!: string;

  @Field(() => String, { nullable: true, description: 'Фактическая сумма (после оплаты/отчёта).' })
  actual_amount?: string;

  @Field(() => ExpenseItemStatus, { description: 'Статус строки.' })
  status!: ExpenseItemStatus;
}
