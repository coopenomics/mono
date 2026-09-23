import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { RefreshSegmentDomainInput } from '../../../domain/actions/refresh-segment-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для обновления сегмента CAPITAL контракта
 */
@InputType('RefreshSegmentInput')
export class RefreshSegmentInputDTO implements RefreshSegmentDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.refreshSegmentInput.coopname.required') })
  @IsString({ message: t('capital.refreshSegmentInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.refreshSegmentInput.projectHash.required') })
  @IsString({ message: t('capital.refreshSegmentInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: t('capital.refreshSegmentInput.username.required') })
  @IsString({ message: t('capital.refreshSegmentInput.username.string') })
  username!: string;
}
