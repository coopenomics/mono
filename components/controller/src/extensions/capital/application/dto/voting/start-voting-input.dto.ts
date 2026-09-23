import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { StartVotingDomainInput } from '../../../domain/actions/start-voting-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для запуска голосования CAPITAL контракта
 */
@InputType('StartVotingInput')
export class StartVotingInputDTO implements StartVotingDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.startVotingInput.coopname.required') })
  @IsString({ message: t('capital.startVotingInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.startVotingInput.projectHash.required') })
  @IsString({ message: t('capital.startVotingInput.projectHash.string') })
  project_hash!: string;
}
