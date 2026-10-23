import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CreateProjectPropertyDomainInput } from '../../../domain/actions/create-project-property-domain-input.interface';

/**
 * GraphQL DTO для создания проектного имущественного взноса CAPITAL контракта
 */
@InputType('CreateProjectPropertyInput')
export class CreateProjectPropertyInputDTO implements CreateProjectPropertyDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.createProjectPropertyInput.coopname.required') })
  @IsString({ message: validationMessage('capital.createProjectPropertyInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: validationMessage('capital.createProjectPropertyInput.username.required') })
  @IsString({ message: validationMessage('capital.createProjectPropertyInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.createProjectPropertyInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.createProjectPropertyInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Хэш имущества' })
  @IsNotEmpty({ message: validationMessage('capital.createProjectPropertyInput.propertyHash.required') })
  @IsString({ message: validationMessage('capital.createProjectPropertyInput.propertyHash.string') })
  property_hash!: string;

  @Field(() => String, { description: 'Сумма имущества' })
  @IsNotEmpty({ message: validationMessage('capital.createProjectPropertyInput.propertyAmount.required') })
  @IsString({ message: validationMessage('capital.createProjectPropertyInput.propertyAmount.string') })
  property_amount!: string;

  @Field(() => String, { description: 'Описание имущества' })
  @IsNotEmpty({ message: validationMessage('capital.createProjectPropertyInput.propertyDescription.required') })
  @IsString({ message: validationMessage('capital.createProjectPropertyInput.propertyDescription.string') })
  property_description!: string;
}
