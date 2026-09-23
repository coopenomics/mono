import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString, IsBoolean } from 'class-validator';
import type { CreateProjectDomainInput } from '../../../domain/actions/create-project-domain-input.interface';

/**
 * GraphQL DTO для создания проекта CAPITAL контракта
 */
@InputType('CreateProjectInput')
export class CreateProjectInputDTO implements CreateProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.createProjectInput.coopname.required') })
  @IsString({ message: validationMessage('capital.createProjectInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.createProjectInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.createProjectInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Хэш родительского проекта' })
  @IsString({ message: validationMessage('capital.createProjectInput.parentHash.string') })
  parent_hash!: string;

  @Field(() => String, { description: 'Название проекта' })
  @IsNotEmpty({ message: validationMessage('capital.createProjectInput.title.required') })
  @IsString({ message: validationMessage('capital.createProjectInput.title.string') })
  title!: string;

  @Field(() => String, { description: 'Описание проекта' })
  @IsNotEmpty({ message: validationMessage('capital.createProjectInput.description.required') })
  @IsString({ message: validationMessage('capital.createProjectInput.description.string') })
  description!: string;

  @Field(() => String, { description: 'Приглашение к проекту' })
  @IsString({ message: validationMessage('capital.createProjectInput.invite.string') })
  invite!: string;

  @Field(() => String, { description: 'Мета-данные проекта' })
  @IsString({ message: validationMessage('capital.createProjectInput.meta.string') })
  meta!: string;

  @Field(() => String, { description: 'Данные/шаблон проекта' })
  @IsString({ message: validationMessage('capital.createProjectInput.data.string') })
  data!: string;
}
