import { Field, ObjectType } from '@nestjs/graphql';
import { ExpenseProposalStatus } from '~/extensions/expenses/domain/enums/expense-proposal-status.enum';
import { ExpenseMechanics } from '~/extensions/expenses/domain/enums/expense-mechanics.enum';
import { ExpenseRecipientType } from '~/extensions/expenses/domain/enums/expense-recipient-type.enum';
import { ExpenseItemStatus } from '~/extensions/expenses/domain/enums/expense-item-status.enum';

/** Owner-callback из шасси (зеркало InterExpenseCallbackHandler). */
@ObjectType('CapitalProgramExpenseCallback')
export class ProgramExpenseCallbackOutputDTO {
  @Field(() => String) contract!: string;
  @Field(() => String) action!: string;
  @Field(() => String) data!: string;
}

/** Item в выводе (зеркало InterExpenseItem). */
@ObjectType('CapitalProgramExpenseItem')
export class ProgramExpenseItemOutputDTO {
  @Field(() => String) item_hash!: string;
  @Field(() => ExpenseMechanics) mechanics!: ExpenseMechanics;
  @Field(() => ExpenseRecipientType) recipient_type!: ExpenseRecipientType;
  @Field(() => String) recipient!: string;
  @Field(() => String, { description: 'Имя получателя (ФИО пайщика или название организации)' })
  recipient_name!: string;
  @Field(() => String) description!: string;
  @Field(() => String) planned_amount!: string;
  @Field(() => String) actual_amount!: string;
  @Field(() => ExpenseItemStatus) status!: ExpenseItemStatus;
}

/**
 * Программный расход в проекции Капитала — те же данные шасси, спроецированные
 * под consumer-extension. Capital НЕ хранит свой mirror items/total — берёт через
 * inter-порт INTER_EXPENSE_CHASSIS.
 */
@ObjectType('CapitalProgramExpense')
export class ProgramExpenseOutputDTO {
  @Field(() => String) coopname!: string;
  @Field(() => String) expense_hash!: string;
  @Field(() => String) creator!: string;
  @Field(() => String, { description: 'Имя инициатора (ФИО пайщика или название организации)' })
  creator_name!: string;
  @Field(() => String) source_wallet!: string;
  @Field(() => ExpenseProposalStatus) status!: ExpenseProposalStatus;
  @Field(() => ProgramExpenseCallbackOutputDTO, { nullable: true })
  callback?: ProgramExpenseCallbackOutputDTO;
  @Field(() => [ProgramExpenseItemOutputDTO]) items!: ProgramExpenseItemOutputDTO[];
  @Field(() => String) total_planned!: string;
  @Field(() => String) total_actual!: string;
  @Field(() => String) created_at!: string;
  @Field(() => String) updated_at!: string;
}
