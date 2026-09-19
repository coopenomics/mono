import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';
import { createPaginationResult, ExpenseProposalStatementSignedDocumentInputDTO } from '@coopenomics/extension-kit';
// Способ оплаты, тип получателя и состояния — словарь шасси расходов из
// межрасширенческого контракта: расход программы идёт тем же процессом, что и
// расход кооперативного участка, и свой набор значений развёл бы схему.
import {
  InnerExpenseItemState as ExpenseItemState,
  InnerExpenseMechanics as ExpenseMechanics,
  InnerExpenseProposalState as ExpenseProposalState,
  InnerExpenseRecipientType as ExpenseRecipientType,
} from '@coopenomics/innercoop';

@InputType('EduExpenseItemInput', { description: 'Позиция расхода программы: кому, сколько и каким способом платим.' })
export class EduExpenseItemInputDTO {
  @Field(() => String, { description: 'Идентификатор позиции расхода' })
  @IsNotEmpty()
  @IsString()
  item_hash!: string;

  @Field(() => ExpenseMechanics, { description: 'Способ оплаты: аванс под отчёт пайщику либо прямая оплата организации' })
  @IsEnum(ExpenseMechanics)
  mechanics!: ExpenseMechanics;

  @Field(() => ExpenseRecipientType, { description: 'Получатель платежа: сам заявитель, другой пайщик или организация' })
  @IsEnum(ExpenseRecipientType)
  recipient_type!: ExpenseRecipientType;

  @Field(() => String, { description: 'Пайщик-получатель; для организации — пустая строка' })
  @ValidateIf((o) => o.recipient_type !== ExpenseRecipientType.ORG)
  @IsNotEmpty()
  @IsString()
  recipient!: string;

  @Field(() => String, { description: 'Назначение расхода по этой позиции' })
  @IsString()
  description!: string;

  @Field(() => String, { description: 'Планируемая сумма позиции' })
  @IsNotEmpty()
  @IsString()
  planned_amount!: string;

  @Field(() => String, { nullable: true, description: 'Сохранённые реквизиты пайщика-получателя' })
  @IsOptional()
  @IsString()
  payment_method_id?: string;

  @Field(() => String, { nullable: true, description: 'Реквизиты организации-получателя' })
  @IsOptional()
  @IsString()
  requisites?: string;

  @Field(() => String, { nullable: true, description: 'Назначение платежа для оплаты по счёту организации' })
  @IsOptional()
  @IsString()
  payment_purpose?: string;
}

@InputType('EduCreateExpenseInput', {
  description: 'Подача расхода программы: средства фонда выделяются под расход, а сам расход уходит на решение совета и далее к оплате.',
})
export class EduCreateExpenseInputDTO {
  @Field(() => String, { description: 'Идентификатор расхода' })
  @IsNotEmpty()
  @IsString()
  expense_hash!: string;

  @Field(() => [EduExpenseItemInputDTO], { description: 'Позиции расхода' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EduExpenseItemInputDTO)
  items!: EduExpenseItemInputDTO[];

  @Field(() => ExpenseProposalStatementSignedDocumentInputDTO, { description: 'Подписанная служебная записка на расход' })
  @ValidateNested()
  @Type(() => ExpenseProposalStatementSignedDocumentInputDTO)
  statement!: ExpenseProposalStatementSignedDocumentInputDTO;
}

@ObjectType('EduExpenseItem')
export class EduExpenseItemDTO {
  @Field(() => String, { description: 'Идентификатор позиции' })
  item_hash!: string;

  @Field(() => ExpenseMechanics, { description: 'Способ оплаты' })
  mechanics!: ExpenseMechanics;

  @Field(() => ExpenseRecipientType, { description: 'Тип получателя' })
  recipient_type!: ExpenseRecipientType;

  @Field(() => String, { description: 'Получатель' })
  recipient!: string;

  @Field(() => String, { description: 'Получатель — ФИО пайщика или название организации' })
  recipient_name!: string;

  @Field(() => String, { description: 'Назначение расхода' })
  description!: string;

  @Field(() => String, { description: 'Планируемая сумма' })
  planned_amount!: string;

  @Field(() => String, { description: 'Фактическая сумма после отчёта' })
  actual_amount!: string;

  @Field(() => ExpenseItemState, { description: 'Состояние позиции' })
  status!: ExpenseItemState;
}

@ObjectType('EduExpense')
export class EduExpenseDTO {
  @Field(() => ID, { description: 'Идентификатор расхода' })
  expense_hash!: string;

  @Field(() => String, { description: 'Кто подал расход' })
  creator!: string;

  @Field(() => String, { description: 'Фамилия, имя и отчество подавшего' })
  creator_name!: string;

  @Field(() => ExpenseProposalState, { description: 'Состояние расхода' })
  status!: ExpenseProposalState;

  @Field(() => [EduExpenseItemDTO], { description: 'Позиции расхода' })
  items!: EduExpenseItemDTO[];

  @Field(() => String, { description: 'Выделено под расход' })
  total_planned!: string;

  @Field(() => String, { description: 'Фактически потрачено' })
  total_actual!: string;

  @Field(() => Date, { description: 'Подан' })
  created_at!: Date;

  @Field(() => Date, { description: 'Изменён' })
  updated_at!: Date;
}

export const PaginatedEduExpensesDTO = createPaginationResult(EduExpenseDTO, 'PaginatedEduExpenses');
