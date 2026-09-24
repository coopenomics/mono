import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { SubmitVoteDomainInput } from '../../../domain/actions/submit-vote-domain-input.interface';

/**
 * DTO для распределения голосов
 */
@InputType('VoteDistributionInput')
export class VoteDistributionInputDTO {
  @Field(() => String, { description: 'Получатель голосов' })
  @IsNotEmpty({ message: validationMessage('capital.submitVoteInput.recipient.required') })
  @IsString({ message: validationMessage('capital.submitVoteInput.recipient.string') })
  recipient!: string;

  @Field(() => String, { description: 'Сумма голосов' })
  @IsNotEmpty({ message: validationMessage('capital.submitVoteInput.amount.required') })
  @IsString({ message: validationMessage('capital.submitVoteInput.amount.string') })
  amount!: string;
}

/**
 * GraphQL DTO для голосования CAPITAL контракта
 */
@InputType('SubmitVoteInput')
export class SubmitVoteInputDTO implements Omit<SubmitVoteDomainInput, 'voter'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.submitVoteInput.coopname.required') })
  @IsString({ message: validationMessage('capital.submitVoteInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.submitVoteInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.submitVoteInput.projectHash.string') })
  project_hash!: string;

  @Field(() => [VoteDistributionInputDTO], { description: 'Распределение голосов' })
  @IsArray({ message: validationMessage('capital.submitVoteInput.votes.array') })
  @ValidateNested({ each: true })
  @Type(() => VoteDistributionInputDTO)
  votes!: VoteDistributionInputDTO[];
}
