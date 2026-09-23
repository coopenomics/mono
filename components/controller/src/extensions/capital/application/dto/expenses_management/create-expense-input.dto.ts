import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import type { CreateExpenseDomainInput } from '../../../domain/actions/create-expense-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для создания расхода CAPITAL контракта
 */
@InputType('CreateExpenseInput')
export class CreateExpenseInputDTO implements CreateExpenseDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.createExpenseInput.coopname.required') })
  @IsString({ message: t('capital.createExpenseInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш расхода' })
  @IsNotEmpty({ message: t('capital.createExpenseInput.expenseHash.required') })
  @IsString({ message: t('capital.createExpenseInput.expenseHash.string') })
  expense_hash!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.createExpenseInput.projectHash.required') })
  @IsString({ message: t('capital.createExpenseInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Сумма расхода' })
  @IsNotEmpty({ message: t('capital.createExpenseInput.amount.required') })
  @IsString({ message: t('capital.createExpenseInput.amount.string') })
  amount!: string;

  @Field(() => String, { description: 'Описание расхода' })
  @IsNotEmpty({ message: t('capital.createExpenseInput.description.required') })
  @IsString({ message: t('capital.createExpenseInput.description.string') })
  description!: string;

  @Field(() => String, { description: 'Исполнитель расхода' })
  @IsNotEmpty({ message: t('capital.createExpenseInput.creator.required') })
  @IsString({ message: t('capital.createExpenseInput.creator.string') })
  creator!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Служебная записка о расходе' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}
