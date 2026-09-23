import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { DeleteProjectDomainInput } from '../../../domain/actions/delete-project-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для удаления проекта CAPITAL контракта
 */
@InputType('DeleteProjectInput')
export class DeleteProjectInputDTO implements DeleteProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.deleteProjectInput.coopname.required') })
  @IsString({ message: t('capital.deleteProjectInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.deleteProjectInput.projectHash.required') })
  @IsString({ message: t('capital.deleteProjectInput.projectHash.string') })
  project_hash!: string;
}
