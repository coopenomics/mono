import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import type { CreateProgramPropertyDomainInput } from '../../../domain/actions/create-program-property-domain-input.interface';
import { SignedDigitalDocumentInputDTO, validationMessage } from '@coopenomics/extension-kit';

/**
 * GraphQL DTO для создания программного имущественного взноса CAPITAL контракта
 */
@InputType('CreateProgramPropertyInput')
export class CreateProgramPropertyInputDTO implements CreateProgramPropertyDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.createProgramPropertyInput.coopname.required') })
  @IsString({ message: validationMessage('capital.createProgramPropertyInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: validationMessage('capital.createProgramPropertyInput.username.required') })
  @IsString({ message: validationMessage('capital.createProgramPropertyInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Хэш имущества' })
  @IsNotEmpty({ message: validationMessage('capital.createProgramPropertyInput.propertyHash.required') })
  @IsString({ message: validationMessage('capital.createProgramPropertyInput.propertyHash.string') })
  property_hash!: string;

  @Field(() => String, { description: 'Сумма имущества' })
  @IsNotEmpty({ message: validationMessage('capital.createProgramPropertyInput.propertyAmount.required') })
  @IsString({ message: validationMessage('capital.createProgramPropertyInput.propertyAmount.string') })
  property_amount!: string;

  @Field(() => String, { description: 'Описание имущества' })
  @IsNotEmpty({ message: validationMessage('capital.createProgramPropertyInput.propertyDescription.required') })
  @IsString({ message: validationMessage('capital.createProgramPropertyInput.propertyDescription.string') })
  property_description!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Заявление' })
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}
