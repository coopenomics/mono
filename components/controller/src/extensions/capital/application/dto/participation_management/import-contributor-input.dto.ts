import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString, IsOptional, Matches } from 'class-validator';
import type { ImportContributorDomainInput } from '../../../domain/actions/import-contributor-domain-input.interface';

/**
 * GraphQL DTO для импорта участника в CAPITAL контракт
 */
@InputType('ImportContributorInput')
export class ImportContributorInputDTO implements ImportContributorDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.importContributorInput.coopname.required') })
  @IsString({ message: validationMessage('capital.importContributorInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsNotEmpty({ message: validationMessage('capital.importContributorInput.username.required') })
  @IsString({ message: validationMessage('capital.importContributorInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Сумма вклада' })
  @IsNotEmpty({ message: validationMessage('capital.importContributorInput.contributionAmount.required') })
  @IsString({ message: validationMessage('capital.importContributorInput.contributionAmount.string') })
  contribution_amount!: string;

  @Field(() => String, { description: 'Номер договора участника' })
  @IsNotEmpty({ message: validationMessage('capital.importContributorInput.contributorContractNumber.required') })
  @IsString({ message: validationMessage('capital.importContributorInput.contributorContractNumber.string') })
  contributor_contract_number!: string;

  @Field(() => String, { description: 'Дата создания договора участника (в формате DD.MM.YYYY)' })
  @IsNotEmpty({ message: validationMessage('capital.importContributorInput.contributorContractCreatedAt.required') })
  @IsString({ message: validationMessage('capital.importContributorInput.contributorContractCreatedAt.string') })
  contributor_contract_created_at!: string;

  @Field(() => String, {
    description: 'Номер соглашения Благорост',
  })
  @IsNotEmpty({ message: validationMessage('capital.importContributorInput.blagorostAgreementNumber.required') })
  @IsString({ message: validationMessage('capital.importContributorInput.blagorostAgreementNumber.string') })
  blagorost_agreement_number!: string;

  @Field(() => String, {
    description: 'Дата соглашения Благорост в формате DD.MM.YYYY',
  })
  @IsNotEmpty({ message: validationMessage('capital.importContributorInput.blagorostAgreementCreatedAt.required') })
  @IsString({ message: validationMessage('capital.importContributorInput.blagorostAgreementCreatedAt.string') })
  blagorost_agreement_created_at!: string;

  @Field(() => String, { description: 'Примечание', nullable: true })
  @IsOptional()
  @IsString({ message: validationMessage('capital.importContributorInput.memo.string') })
  memo?: string;
}
