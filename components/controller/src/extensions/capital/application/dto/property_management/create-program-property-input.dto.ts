import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import type { CreateProgramPropertyDomainInput } from '../../../domain/actions/create-program-property-domain-input.interface';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для создания программного имущественного взноса CAPITAL контракта
 */
@InputType('CreateProgramPropertyInput')
export class CreateProgramPropertyInputDTO implements CreateProgramPropertyDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.createProgramPropertyInput.coopname.required') })
  @IsString({ message: t('capital.createProgramPropertyInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: t('capital.createProgramPropertyInput.username.required') })
  @IsString({ message: t('capital.createProgramPropertyInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Хэш имущества' })
  @IsNotEmpty({ message: t('capital.createProgramPropertyInput.propertyHash.required') })
  @IsString({ message: t('capital.createProgramPropertyInput.propertyHash.string') })
  property_hash!: string;

  @Field(() => String, { description: 'Сумма имущества' })
  @IsNotEmpty({ message: t('capital.createProgramPropertyInput.propertyAmount.required') })
  @IsString({ message: t('capital.createProgramPropertyInput.propertyAmount.string') })
  property_amount!: string;

  @Field(() => String, { description: 'Описание имущества' })
  @IsNotEmpty({ message: t('capital.createProgramPropertyInput.propertyDescription.required') })
  @IsString({ message: t('capital.createProgramPropertyInput.propertyDescription.string') })
  property_description!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Заявление' })
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}
