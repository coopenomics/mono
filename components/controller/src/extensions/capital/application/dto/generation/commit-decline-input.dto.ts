import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CommitDeclineDomainInput } from '../../../domain/actions/commit-decline-domain-input.interface';

/**
 * GraphQL DTO для отклонения коммита CAPITAL контракта
 */
@InputType('CommitDeclineInput')
export class CommitDeclineInputDTO implements Omit<CommitDeclineDomainInput, 'master'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.commitDeclineInput.coopname.required') })
  @IsString({ message: validationMessage('capital.commitDeclineInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш коммита для отклонения' })
  @IsNotEmpty({ message: validationMessage('capital.commitDeclineInput.commitHash.required') })
  @IsString({ message: validationMessage('capital.commitDeclineInput.commitHash.string') })
  commit_hash!: string;

  @Field(() => String, { description: 'Причина отклонения' })
  @IsNotEmpty({ message: validationMessage('capital.commitDeclineInput.reason.required') })
  @IsString({ message: validationMessage('capital.commitDeclineInput.reason.string') })
  reason!: string;
}
