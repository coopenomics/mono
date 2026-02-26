import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import type { CreateProgramPropertyDomainInput } from '~/extensions/capital/domain/actions/create-program-property-domain-input.interface';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';

/**
 * GraphQL DTO для создания программного имущественного взноса CAPITAL контракта
 */
@InputType('CreateProgramPropertyInput')
export class CreateProgramPropertyInputDTO implements CreateProgramPropertyDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: 'Имя пользователя не должно быть пустым' })
  @IsString({ message: 'Имя пользователя должно быть строкой' })
  username!: string;

  @Field(() => String, { description: 'Хэш имущества' })
  @IsNotEmpty({ message: 'Хэш имущества не должен быть пустым' })
  @IsString({ message: 'Хэш имущества должен быть строкой' })
  property_hash!: string;

  @Field(() => String, { description: 'Сумма имущества' })
  @IsNotEmpty({ message: 'Сумма имущества не должна быть пустой' })
  @IsString({ message: 'Сумма имущества должна быть строкой' })
  property_amount!: string;

  @Field(() => String, { description: 'Описание имущества' })
  @IsNotEmpty({ message: 'Описание имущества не должно быть пустым' })
  @IsString({ message: 'Описание имущества должно быть строкой' })
  property_description!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Заявление' })
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}
