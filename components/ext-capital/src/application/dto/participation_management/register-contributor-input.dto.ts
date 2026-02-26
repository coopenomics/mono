import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import type { RegisterContributorDomainInput } from '../../../domain/actions/register-contributor-domain-input.interface';
import { GenerationContractSignedDocumentInputDTO } from '~/application/document/documents-dto/generation-agreement-document.dto';

/**
 * GraphQL DTO для регистрации участника CAPITAL контракта
 */
@InputType('RegisterContributorInput')
export class RegisterContributorInputDTO implements RegisterContributorDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: 'Имя пользователя не должно быть пустым' })
  @IsString({ message: 'Имя пользователя должно быть строкой' })
  username!: string;

  @Field(() => String, { description: 'Хэш участника для верификации документа' })
  @IsNotEmpty({ message: 'Хэш участника не должен быть пустым' })
  @IsString({ message: 'Хэш участника должен быть строкой' })
  contributor_hash!: string;

  @Field(() => String, { description: 'О себе', nullable: true })
  @IsOptional()
  @IsString({ message: 'О себе должно быть строкой' })
  about?: string;

  @Field(() => String, { description: 'Ставка за час работы', nullable: true })
  @IsOptional()
  @IsString({ message: 'Ставка за час работы должна быть строкой' })
  rate_per_hour?: string;

  @Field(() => Number, { description: 'Часов в день', nullable: true })
  @IsOptional()
  @IsNumber({}, { message: 'Часов в день должно быть числом' })
  @Type(() => Number)
  hours_per_day?: number;

  @Field(() => GenerationContractSignedDocumentInputDTO, { description: 'Документ контракта' })
  @Type(() => GenerationContractSignedDocumentInputDTO)
  contract!: GenerationContractSignedDocumentInputDTO;
}
