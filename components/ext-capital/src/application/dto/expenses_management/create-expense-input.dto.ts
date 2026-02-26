import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import type { CreateExpenseDomainInput } from '~/extensions/capital/domain/actions/create-expense-domain-input.interface';

/**
 * GraphQL DTO для создания расхода CAPITAL контракта
 */
@InputType('CreateExpenseInput')
export class CreateExpenseInputDTO implements CreateExpenseDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Хэш расхода' })
  @IsNotEmpty({ message: 'Хэш расхода не должен быть пустым' })
  @IsString({ message: 'Хэш расхода должен быть строкой' })
  expense_hash!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: 'Хэш проекта не должен быть пустым' })
  @IsString({ message: 'Хэш проекта должен быть строкой' })
  project_hash!: string;

  @Field(() => String, { description: 'Сумма расхода' })
  @IsNotEmpty({ message: 'Сумма расхода не должна быть пустой' })
  @IsString({ message: 'Сумма расхода должна быть строкой' })
  amount!: string;

  @Field(() => String, { description: 'Описание расхода' })
  @IsNotEmpty({ message: 'Описание расхода не должно быть пустым' })
  @IsString({ message: 'Описание расхода должно быть строкой' })
  description!: string;

  @Field(() => String, { description: 'Исполнитель расхода' })
  @IsNotEmpty({ message: 'Исполнитель расхода не должен быть пустым' })
  @IsString({ message: 'Исполнитель расхода должен быть строкой' })
  creator!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Служебная записка о расходе' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}
