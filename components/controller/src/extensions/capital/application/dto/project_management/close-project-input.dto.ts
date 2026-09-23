import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CloseProjectDomainInput } from '../../../domain/actions/close-project-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для закрытия проекта от инвестиций CAPITAL контракта
 */
@InputType('CloseProjectInput')
export class CloseProjectInputDTO implements CloseProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.closeProjectInput.coopname.required') })
  @IsString({ message: t('capital.closeProjectInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.closeProjectInput.projectHash.required') })
  @IsString({ message: t('capital.closeProjectInput.projectHash.string') })
  project_hash!: string;
}
