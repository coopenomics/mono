import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CreateProjectPropertyDomainInput } from '../../../domain/actions/create-project-property-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для создания проектного имущественного взноса CAPITAL контракта
 */
@InputType('CreateProjectPropertyInput')
export class CreateProjectPropertyInputDTO implements CreateProjectPropertyDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.createProjectPropertyInput.coopname.required') })
  @IsString({ message: t('capital.createProjectPropertyInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: t('capital.createProjectPropertyInput.username.required') })
  @IsString({ message: t('capital.createProjectPropertyInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.createProjectPropertyInput.projectHash.required') })
  @IsString({ message: t('capital.createProjectPropertyInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Хэш имущества' })
  @IsNotEmpty({ message: t('capital.createProjectPropertyInput.propertyHash.required') })
  @IsString({ message: t('capital.createProjectPropertyInput.propertyHash.string') })
  property_hash!: string;

  @Field(() => String, { description: 'Сумма имущества' })
  @IsNotEmpty({ message: t('capital.createProjectPropertyInput.propertyAmount.required') })
  @IsString({ message: t('capital.createProjectPropertyInput.propertyAmount.string') })
  property_amount!: string;

  @Field(() => String, { description: 'Описание имущества' })
  @IsNotEmpty({ message: t('capital.createProjectPropertyInput.propertyDescription.required') })
  @IsString({ message: t('capital.createProjectPropertyInput.propertyDescription.string') })
  property_description!: string;
}
