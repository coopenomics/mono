import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CalculateVotesDomainInput } from '../../../domain/actions/calculate-votes-domain-input.interface';

/**
 * GraphQL DTO для расчета голосов CAPITAL контракта
 */
@InputType('CalculateVotesInput')
export class CalculateVotesInputDTO implements CalculateVotesDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.calculateVotesInput.coopname.required') })
  @IsString({ message: validationMessage('capital.calculateVotesInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: validationMessage('capital.calculateVotesInput.username.required') })
  @IsString({ message: validationMessage('capital.calculateVotesInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.calculateVotesInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.calculateVotesInput.projectHash.string') })
  project_hash!: string;
}
