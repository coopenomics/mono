import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { StartProjectDomainInput } from '../../../domain/actions/start-project-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для запуска проекта CAPITAL контракта
 */
@InputType('StartProjectInput')
export class StartProjectInputDTO implements StartProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.startProjectInput.coopname.required') })
  @IsString({ message: t('capital.startProjectInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.startProjectInput.projectHash.required') })
  @IsString({ message: t('capital.startProjectInput.projectHash.string') })
  project_hash!: string;
}
