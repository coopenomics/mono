import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CommitApproveDomainInput } from '../../../domain/actions/commit-approve-domain-input.interface';

/**
 * GraphQL DTO для одобрения коммита CAPITAL контракта
 */
@InputType('CommitApproveInput')
export class CommitApproveInputDTO implements Omit<CommitApproveDomainInput, 'master'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Хэш коммита для одобрения' })
  @IsNotEmpty({ message: 'Хэш коммита не должен быть пустым' })
  @IsString({ message: 'Хэш коммита должен быть строкой' })
  commit_hash!: string;
}
