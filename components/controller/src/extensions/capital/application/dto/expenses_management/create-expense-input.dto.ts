import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { SignedDigitalDocumentInputDTO, validationMessage } from '@coopenomics/extension-kit';
import type { CreateExpenseDomainInput } from '../../../domain/actions/create-expense-domain-input.interface';

/**
 * GraphQL DTO для создания расхода CAPITAL контракта
 */
@InputType('CreateExpenseInput')
export class CreateExpenseInputDTO implements CreateExpenseDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.createExpenseInput.coopname.required') })
  @IsString({ message: validationMessage('capital.createExpenseInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш расхода' })
  @IsNotEmpty({ message: validationMessage('capital.createExpenseInput.expenseHash.required') })
  @IsString({ message: validationMessage('capital.createExpenseInput.expenseHash.string') })
  expense_hash!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.createExpenseInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.createExpenseInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Сумма расхода' })
  @IsNotEmpty({ message: validationMessage('capital.createExpenseInput.amount.required') })
  @IsString({ message: validationMessage('capital.createExpenseInput.amount.string') })
  amount!: string;

  @Field(() => String, { description: 'Описание расхода' })
  @IsNotEmpty({ message: validationMessage('capital.createExpenseInput.description.required') })
  @IsString({ message: validationMessage('capital.createExpenseInput.description.string') })
  description!: string;

  @Field(() => String, { description: 'Исполнитель расхода' })
  @IsNotEmpty({ message: validationMessage('capital.createExpenseInput.creator.required') })
  @IsString({ message: validationMessage('capital.createExpenseInput.creator.string') })
  creator!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Служебная записка о расходе' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}
