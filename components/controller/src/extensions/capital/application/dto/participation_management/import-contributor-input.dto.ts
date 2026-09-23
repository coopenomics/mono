import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, Matches } from 'class-validator';
import type { ImportContributorDomainInput } from '../../../domain/actions/import-contributor-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для импорта участника в CAPITAL контракт
 */
@InputType('ImportContributorInput')
export class ImportContributorInputDTO implements ImportContributorDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.importContributorInput.coopname.required') })
  @IsString({ message: t('capital.importContributorInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsNotEmpty({ message: t('capital.importContributorInput.username.required') })
  @IsString({ message: t('capital.importContributorInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Сумма вклада' })
  @IsNotEmpty({ message: t('capital.importContributorInput.contributionAmount.required') })
  @IsString({ message: t('capital.importContributorInput.contributionAmount.string') })
  contribution_amount!: string;

  @Field(() => String, { description: 'Номер договора участника' })
  @IsNotEmpty({ message: t('capital.importContributorInput.contributorContractNumber.required') })
  @IsString({ message: t('capital.importContributorInput.contributorContractNumber.string') })
  contributor_contract_number!: string;

  @Field(() => String, { description: 'Дата создания договора участника (в формате DD.MM.YYYY)' })
  @IsNotEmpty({ message: t('capital.importContributorInput.contributorContractCreatedAt.required') })
  @IsString({ message: t('capital.importContributorInput.contributorContractCreatedAt.string') })
  contributor_contract_created_at!: string;

  @Field(() => String, {
    description: 'Номер соглашения Благорост',
  })
  @IsNotEmpty({ message: t('capital.importContributorInput.blagorostAgreementNumber.required') })
  @IsString({ message: t('capital.importContributorInput.blagorostAgreementNumber.string') })
  blagorost_agreement_number!: string;

  @Field(() => String, {
    description: 'Дата соглашения Благорост в формате DD.MM.YYYY',
  })
  @IsNotEmpty({ message: t('capital.importContributorInput.blagorostAgreementCreatedAt.required') })
  @IsString({ message: t('capital.importContributorInput.blagorostAgreementCreatedAt.string') })
  blagorost_agreement_created_at!: string;

  @Field(() => String, { description: 'Примечание', nullable: true })
  @IsOptional()
  @IsString({ message: t('capital.importContributorInput.memo.string') })
  memo?: string;
}
