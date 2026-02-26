import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';
import type { EditProjectDomainInput } from '../../../domain/actions/edit-project-domain-input.interface';

/**
 * GraphQL DTO для редактирования проекта CAPITAL контракта
 */
@InputType('EditProjectInput')
export class EditProjectInputDTO implements EditProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта для редактирования' })
  @IsNotEmpty({ message: 'Хэш проекта не должен быть пустым' })
  @IsString({ message: 'Хэш проекта должен быть строкой' })
  project_hash!: string;

  @Field(() => String, { description: 'Новое название проекта' })
  @IsString({ message: 'Название проекта должно быть строкой' })
  title!: string;

  @Field(() => String, { description: 'Новое описание проекта' })
  @IsString({ message: 'Описание проекта должно быть строкой' })
  description!: string;

  @Field(() => String, { description: 'Новое приглашение к проекту' })
  @IsString({ message: 'Приглашение к проекту должно быть строкой' })
  invite!: string;

  @Field(() => String, { description: 'Новые мета-данные проекта' })
  @IsString({ message: 'Мета-данные проекта должны быть строкой' })
  meta!: string;

  @Field(() => String, { description: 'Новые данные/шаблон проекта' })
  @IsString({ message: 'Данные/шаблон проекта должны быть строкой' })
  data!: string;
}
