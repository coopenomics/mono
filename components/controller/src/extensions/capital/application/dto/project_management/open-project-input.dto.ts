import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { OpenProjectDomainInput } from '../../../domain/actions/open-project-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для открытия проекта для инвестиций CAPITAL контракта
 */
@InputType('OpenProjectInput')
export class OpenProjectInputDTO implements OpenProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.openProjectInput.coopname.required') })
  @IsString({ message: t('capital.openProjectInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.openProjectInput.projectHash.required') })
  @IsString({ message: t('capital.openProjectInput.projectHash.string') })
  project_hash!: string;
}
