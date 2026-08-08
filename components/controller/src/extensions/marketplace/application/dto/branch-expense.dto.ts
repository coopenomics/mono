import { Field, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ExpenseProposalStatementSignedDocumentInputDTO } from '~/application/document/documents-dto/expense-proposal-statement-document.dto';
// Способ оплаты и тип получателя — общий словарь шасси расходов: расход
// участка идёт тем же процессом, свой параллельный набор значений развёл бы
// схему и заставил фронт конвертировать типы.
import { ExpenseMechanics } from '../../../expenses/domain/enums/expense-mechanics.enum';
import { ExpenseRecipientType } from '../../../expenses/domain/enums/expense-recipient-type.enum';

@InputType('BranchExpenseItemInput', {
  description: 'Позиция расхода кооперативного участка: кому, сколько и каким способом платим.',
})
export class BranchExpenseItemInputDTO {
  @Field(() => String, { description: 'Идентификатор позиции расхода.' })
  @IsNotEmpty()
  @IsString()
  item_hash!: string;

  @Field(() => ExpenseMechanics, {
    description: 'Способ оплаты: аванс под отчёт пайщику либо прямая оплата организации.',
  })
  @IsEnum(ExpenseMechanics)
  mechanics!: ExpenseMechanics;

  @Field(() => ExpenseRecipientType, {
    description: 'Получатель платежа: сам заявитель, другой пайщик или организация.',
  })
  @IsEnum(ExpenseRecipientType)
  recipient_type!: ExpenseRecipientType;

  @Field(() => String, {
    description: 'Пайщик-получатель; для организации — пустая строка.',
  })
  @ValidateIf((o) => o.recipient_type !== ExpenseRecipientType.ORG)
  @IsNotEmpty()
  @IsString()
  recipient!: string;

  @Field(() => String, { description: 'Назначение расхода по этой позиции.' })
  @IsString()
  description!: string;

  @Field(() => String, { description: 'Планируемая сумма позиции.' })
  @IsNotEmpty()
  @IsString()
  planned_amount!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Сохранённые реквизиты пайщика-получателя — фиксируются в момент подачи.',
  })
  @IsOptional()
  @IsString()
  payment_method_id?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Реквизиты организации-получателя (вводятся вручную).',
  })
  @IsOptional()
  @IsString()
  requisites?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Назначение платежа для оплаты по счёту организации.',
  })
  @IsOptional()
  @IsString()
  payment_purpose?: string;
}

@InputType('CreateBranchExpenseInput', {
  description:
    'Подача расхода кооперативного участка: средства участка выделяются под расход, а сам расход уходит на решение совета и далее к оплате.',
})
export class CreateBranchExpenseInputDTO {
  @Field(() => String, { description: 'Кооперативный участок, из средств которого оплачивается расход.' })
  @IsNotEmpty()
  @IsString()
  braname!: string;

  @Field(() => String, { description: 'Идентификатор расхода.' })
  @IsNotEmpty()
  @IsString()
  expense_hash!: string;

  @Field(() => [BranchExpenseItemInputDTO], { description: 'Позиции расхода.' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BranchExpenseItemInputDTO)
  items!: BranchExpenseItemInputDTO[];

  @Field(() => ExpenseProposalStatementSignedDocumentInputDTO, {
    description: 'Подписанная служебная записка на расход.',
  })
  @ValidateNested()
  @Type(() => ExpenseProposalStatementSignedDocumentInputDTO)
  statement!: ExpenseProposalStatementSignedDocumentInputDTO;

  @Field(() => Int, {
    nullable: true,
    description: 'Плановый расход, который оплачивается этим расходом.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  plan_id?: number;
}
