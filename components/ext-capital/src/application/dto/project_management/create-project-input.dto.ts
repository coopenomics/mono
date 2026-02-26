import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsBoolean } from 'class-validator';
import type { CreateProjectDomainInput } from '../../../domain/actions/create-project-domain-input.interface';

/**
 * GraphQL DTO для создания проекта CAPITAL контракта
 */
@InputType('CreateProjectInput')
export class CreateProjectInputDTO implements CreateProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: 'Хэш проекта не должен быть пустым' })
  @IsString({ message: 'Хэш проекта должен быть строкой' })
  project_hash!: string;

  @Field(() => String, { description: 'Хэш родительского проекта' })
  @IsString({ message: 'Хэш родительского проекта должен быть строкой' })
  parent_hash!: string;

  @Field(() => String, { description: 'Название проекта' })
  @IsNotEmpty({ message: 'Название проекта не должно быть пустым' })
  @IsString({ message: 'Название проекта должно быть строкой' })
  title!: string;

  @Field(() => String, { description: 'Описание проекта' })
  @IsNotEmpty({ message: 'Описание проекта не должно быть пустым' })
  @IsString({ message: 'Описание проекта должно быть строкой' })
  description!: string;

  @Field(() => String, { description: 'Приглашение к проекту' })
  @IsString({ message: 'Приглашение к проекту должно быть строкой' })
  invite!: string;

  @Field(() => String, { description: 'Мета-данные проекта' })
  @IsString({ message: 'Мета-данные проекта должны быть строкой' })
  meta!: string;

  @Field(() => String, { description: 'Данные/шаблон проекта' })
  @IsString({ message: 'Данные/шаблон проекта должны быть строкой' })
  data!: string;
}
