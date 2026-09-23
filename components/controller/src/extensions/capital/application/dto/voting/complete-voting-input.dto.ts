import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CompleteVotingDomainInput } from '../../../domain/actions/complete-voting-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для завершения голосования CAPITAL контракта
 */
@InputType('CompleteVotingInput')
export class CompleteVotingInputDTO implements CompleteVotingDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.completeVotingInput.coopname.required') })
  @IsString({ message: t('capital.completeVotingInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.completeVotingInput.projectHash.required') })
  @IsString({ message: t('capital.completeVotingInput.projectHash.string') })
  project_hash!: string;
}
