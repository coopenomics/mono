import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CommitDeclineDomainInput } from '../../../domain/actions/commit-decline-domain-input.interface';

/**
 * GraphQL DTO для отклонения коммита CAPITAL контракта
 */
@InputType('CommitDeclineInput')
export class CommitDeclineInputDTO implements Omit<CommitDeclineDomainInput, 'master'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Хэш коммита для отклонения' })
  @IsNotEmpty({ message: 'Хэш коммита не должен быть пустым' })
  @IsString({ message: 'Хэш коммита должен быть строкой' })
  commit_hash!: string;

  @Field(() => String, { description: 'Причина отклонения' })
  @IsNotEmpty({ message: 'Причина отклонения не должна быть пустой' })
  @IsString({ message: 'Причина отклонения должна быть строкой' })
  reason!: string;
}
