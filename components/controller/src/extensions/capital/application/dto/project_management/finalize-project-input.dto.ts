import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { IFinalizeProjectDomainInput } from '../../../domain/actions/finalize-project-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для финализации проекта CAPITAL контракта
 * Финализация проекта после завершения всех конвертаций участников
 */
@InputType('FinalizeProjectInput')
export class FinalizeProjectInputDTO implements IFinalizeProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.finalizeProjectInput.coopname.required') })
  @IsString({ message: t('capital.finalizeProjectInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта для финализации' })
  @IsNotEmpty({ message: t('capital.finalizeProjectInput.projectHash.required') })
  @IsString({ message: t('capital.finalizeProjectInput.projectHash.string') })
  project_hash!: string;
}
