import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { StopProjectDomainInput } from '../../../domain/actions/stop-project-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для остановки проекта CAPITAL контракта
 */
@InputType('StopProjectInput')
export class StopProjectInputDTO implements StopProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.stopProjectInput.coopname.required') })
  @IsString({ message: t('capital.stopProjectInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.stopProjectInput.projectHash.required') })
  @IsString({ message: t('capital.stopProjectInput.projectHash.string') })
  project_hash!: string;
}
