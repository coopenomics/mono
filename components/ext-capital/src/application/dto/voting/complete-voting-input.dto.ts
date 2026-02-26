import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CompleteVotingDomainInput } from '../../../domain/actions/complete-voting-domain-input.interface';

/**
 * GraphQL DTO для завершения голосования CAPITAL контракта
 */
@InputType('CompleteVotingInput')
export class CompleteVotingInputDTO implements CompleteVotingDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: 'Хэш проекта не должен быть пустым' })
  @IsString({ message: 'Хэш проекта должен быть строкой' })
  project_hash!: string;
}
