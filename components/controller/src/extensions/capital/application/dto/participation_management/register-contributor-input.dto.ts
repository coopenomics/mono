import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import type { RegisterContributorDomainInput } from '../../../domain/actions/register-contributor-domain-input.interface';
import { GenerationContractSignedDocumentInputDTO } from '../../documents-dto/generation-agreement-document.dto';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для регистрации участника CAPITAL контракта
 */
@InputType('RegisterContributorInput')
export class RegisterContributorInputDTO implements RegisterContributorDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.registerContributorInput.coopname.required') })
  @IsString({ message: t('capital.registerContributorInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: t('capital.registerContributorInput.username.required') })
  @IsString({ message: t('capital.registerContributorInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Хэш участника для верификации документа' })
  @IsNotEmpty({ message: t('capital.registerContributorInput.contributorHash.required') })
  @IsString({ message: t('capital.registerContributorInput.contributorHash.string') })
  contributor_hash!: string;

  @Field(() => String, { description: 'О себе', nullable: true })
  @IsOptional()
  @IsString({ message: t('capital.registerContributorInput.about.string') })
  about?: string;

  @Field(() => String, { description: 'Ставка за час работы', nullable: true })
  @IsOptional()
  @IsString({ message: t('capital.registerContributorInput.ratePerHour.string') })
  rate_per_hour?: string;

  @Field(() => Number, { description: 'Часов в день', nullable: true })
  @IsOptional()
  @IsNumber({}, { message: t('capital.registerContributorInput.hoursPerDay.number') })
  @Type(() => Number)
  hours_per_day?: number;

  @Field(() => GenerationContractSignedDocumentInputDTO, { description: 'Документ контракта' })
  @Type(() => GenerationContractSignedDocumentInputDTO)
  contract!: GenerationContractSignedDocumentInputDTO;
}
