import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsBoolean } from 'class-validator';
import type { CreateProjectDomainInput } from '../../../domain/actions/create-project-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для создания проекта CAPITAL контракта
 */
@InputType('CreateProjectInput')
export class CreateProjectInputDTO implements CreateProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.createProjectInput.coopname.required') })
  @IsString({ message: t('capital.createProjectInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.createProjectInput.projectHash.required') })
  @IsString({ message: t('capital.createProjectInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Хэш родительского проекта' })
  @IsString({ message: t('capital.createProjectInput.parentHash.string') })
  parent_hash!: string;

  @Field(() => String, { description: 'Название проекта' })
  @IsNotEmpty({ message: t('capital.createProjectInput.title.required') })
  @IsString({ message: t('capital.createProjectInput.title.string') })
  title!: string;

  @Field(() => String, { description: 'Описание проекта' })
  @IsNotEmpty({ message: t('capital.createProjectInput.description.required') })
  @IsString({ message: t('capital.createProjectInput.description.string') })
  description!: string;

  @Field(() => String, { description: 'Приглашение к проекту' })
  @IsString({ message: t('capital.createProjectInput.invite.string') })
  invite!: string;

  @Field(() => String, { description: 'Мета-данные проекта' })
  @IsString({ message: t('capital.createProjectInput.meta.string') })
  meta!: string;

  @Field(() => String, { description: 'Данные/шаблон проекта' })
  @IsString({ message: t('capital.createProjectInput.data.string') })
  data!: string;
}
