import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CommitApproveDomainInput } from '../../../domain/actions/commit-approve-domain-input.interface';

/**
 * GraphQL DTO для одобрения коммита CAPITAL контракта
 */
@InputType('CommitApproveInput')
export class CommitApproveInputDTO implements Omit<CommitApproveDomainInput, 'master'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.commitApproveInput.coopname.required') })
  @IsString({ message: validationMessage('capital.commitApproveInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш коммита для одобрения' })
  @IsNotEmpty({ message: validationMessage('capital.commitApproveInput.commitHash.required') })
  @IsString({ message: validationMessage('capital.commitApproveInput.commitHash.string') })
  commit_hash!: string;
}
