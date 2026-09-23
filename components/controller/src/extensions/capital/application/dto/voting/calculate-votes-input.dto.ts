import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CalculateVotesDomainInput } from '../../../domain/actions/calculate-votes-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для расчета голосов CAPITAL контракта
 */
@InputType('CalculateVotesInput')
export class CalculateVotesInputDTO implements CalculateVotesDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.calculateVotesInput.coopname.required') })
  @IsString({ message: t('capital.calculateVotesInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: t('capital.calculateVotesInput.username.required') })
  @IsString({ message: t('capital.calculateVotesInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.calculateVotesInput.projectHash.required') })
  @IsString({ message: t('capital.calculateVotesInput.projectHash.string') })
  project_hash!: string;
}
