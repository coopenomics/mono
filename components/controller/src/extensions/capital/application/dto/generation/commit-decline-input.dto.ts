import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CommitDeclineDomainInput } from '../../../domain/actions/commit-decline-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для отклонения коммита CAPITAL контракта
 */
@InputType('CommitDeclineInput')
export class CommitDeclineInputDTO implements Omit<CommitDeclineDomainInput, 'master'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.commitDeclineInput.coopname.required') })
  @IsString({ message: t('capital.commitDeclineInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш коммита для отклонения' })
  @IsNotEmpty({ message: t('capital.commitDeclineInput.commitHash.required') })
  @IsString({ message: t('capital.commitDeclineInput.commitHash.string') })
  commit_hash!: string;

  @Field(() => String, { description: 'Причина отклонения' })
  @IsNotEmpty({ message: t('capital.commitDeclineInput.reason.required') })
  @IsString({ message: t('capital.commitDeclineInput.reason.string') })
  reason!: string;
}
