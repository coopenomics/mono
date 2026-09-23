import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { SubmitVoteDomainInput } from '../../../domain/actions/submit-vote-domain-input.interface';
import { t } from '../../../i18n';

/**
 * DTO для распределения голосов
 */
@InputType('VoteDistributionInput')
export class VoteDistributionInputDTO {
  @Field(() => String, { description: 'Получатель голосов' })
  @IsNotEmpty({ message: t('capital.submitVoteInput.recipient.required') })
  @IsString({ message: t('capital.submitVoteInput.recipient.string') })
  recipient!: string;

  @Field(() => String, { description: 'Сумма голосов' })
  @IsNotEmpty({ message: t('capital.submitVoteInput.amount.required') })
  @IsString({ message: t('capital.submitVoteInput.amount.string') })
  amount!: string;
}

/**
 * GraphQL DTO для голосования CAPITAL контракта
 */
@InputType('SubmitVoteInput')
export class SubmitVoteInputDTO implements Omit<SubmitVoteDomainInput, 'voter'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.submitVoteInput.coopname.required') })
  @IsString({ message: t('capital.submitVoteInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.submitVoteInput.projectHash.required') })
  @IsString({ message: t('capital.submitVoteInput.projectHash.string') })
  project_hash!: string;

  @Field(() => [VoteDistributionInputDTO], { description: 'Распределение голосов' })
  @IsArray({ message: t('capital.submitVoteInput.votes.array') })
  @ValidateNested({ each: true })
  @Type(() => VoteDistributionInputDTO)
  votes!: VoteDistributionInputDTO[];
}
