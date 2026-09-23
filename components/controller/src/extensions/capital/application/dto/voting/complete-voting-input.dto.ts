import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CompleteVotingDomainInput } from '../../../domain/actions/complete-voting-domain-input.interface';

/**
 * GraphQL DTO для завершения голосования CAPITAL контракта
 */
@InputType('CompleteVotingInput')
export class CompleteVotingInputDTO implements CompleteVotingDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.completeVotingInput.coopname.required') })
  @IsString({ message: validationMessage('capital.completeVotingInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.completeVotingInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.completeVotingInput.projectHash.string') })
  project_hash!: string;
}
