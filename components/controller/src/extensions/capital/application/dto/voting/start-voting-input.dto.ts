import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { StartVotingDomainInput } from '../../../domain/actions/start-voting-domain-input.interface';

/**
 * GraphQL DTO для запуска голосования CAPITAL контракта
 */
@InputType('StartVotingInput')
export class StartVotingInputDTO implements StartVotingDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.startVotingInput.coopname.required') })
  @IsString({ message: validationMessage('capital.startVotingInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.startVotingInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.startVotingInput.projectHash.string') })
  project_hash!: string;
}
