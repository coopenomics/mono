import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import type { CreateDebtDomainInput } from '../../../domain/actions/create-debt-domain-input.interface';
import { SignedDigitalDocumentInputDTO, validationMessage } from '@coopenomics/extension-kit';

/**
 * GraphQL DTO для создания долга CAPITAL контракта
 */
@InputType('CreateDebtInput')
export class CreateDebtInputDTO implements CreateDebtDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.createDebtInput.coopname.required') })
  @IsString({ message: validationMessage('capital.createDebtInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: validationMessage('capital.createDebtInput.username.required') })
  @IsString({ message: validationMessage('capital.createDebtInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Хэш долга' })
  @IsNotEmpty({ message: validationMessage('capital.createDebtInput.debtHash.required') })
  @IsString({ message: validationMessage('capital.createDebtInput.debtHash.string') })
  debt_hash!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.createDebtInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.createDebtInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Сумма долга' })
  @IsNotEmpty({ message: validationMessage('capital.createDebtInput.amount.required') })
  @IsString({ message: validationMessage('capital.createDebtInput.amount.string') })
  amount!: string;

  @Field(() => String, { description: 'Дата возврата' })
  @IsNotEmpty({ message: validationMessage('capital.createDebtInput.repaidAt.required') })
  @IsString({ message: validationMessage('capital.createDebtInput.repaidAt.string') })
  repaid_at!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Заявление на получение ссуды' })
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}
