import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CommitApproveDomainInput } from '../../../domain/actions/commit-approve-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для одобрения коммита CAPITAL контракта
 */
@InputType('CommitApproveInput')
export class CommitApproveInputDTO implements Omit<CommitApproveDomainInput, 'master'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.commitApproveInput.coopname.required') })
  @IsString({ message: t('capital.commitApproveInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш коммита для одобрения' })
  @IsNotEmpty({ message: t('capital.commitApproveInput.commitHash.required') })
  @IsString({ message: t('capital.commitApproveInput.commitHash.string') })
  commit_hash!: string;
}
