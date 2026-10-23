import { Field, InputType, Int } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString, IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { ContentRevisionOrigin } from '../../../domain/enums/content-revision-origin.enum';
import type { EditProjectDomainInput } from '../../../domain/actions/edit-project-domain-input.interface';

/**
 * GraphQL DTO для редактирования проекта CAPITAL контракта
 */
@InputType('EditProjectInput')
export class EditProjectInputDTO implements EditProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.editProjectInput.coopname.required') })
  @IsString({ message: validationMessage('capital.editProjectInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта для редактирования' })
  @IsNotEmpty({ message: validationMessage('capital.editProjectInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.editProjectInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Новое название проекта' })
  @IsString({ message: validationMessage('capital.editProjectInput.title.string') })
  title!: string;

  @Field(() => String, { description: 'Новое описание проекта' })
  @IsString({ message: validationMessage('capital.editProjectInput.description.string') })
  description!: string;

  @Field(() => String, { description: 'Новое приглашение к проекту' })
  @IsString({ message: validationMessage('capital.editProjectInput.invite.string') })
  invite!: string;

  @Field(() => String, { description: 'Новые мета-данные проекта' })
  @IsString({ message: validationMessage('capital.editProjectInput.meta.string') })
  meta!: string;

  @Field(() => String, { description: 'Новые данные/шаблон проекта' })
  @IsString({ message: validationMessage('capital.editProjectInput.data.string') })
  data!: string;

  @Field(() => Int, {
    nullable: true,
    description:
      'Редакция содержимого (content_rev), с которой автор начал правку. Сервер сливает правку с параллельными изменениями; без поля — запись без проверки версии',
  })
  @IsOptional()
  @IsInt({ message: validationMessage('capital.editProjectInput.baseRev.int') })
  @Min(0, { message: validationMessage('capital.editProjectInput.baseRev.min') })
  base_rev?: number;

  @Field(() => ContentRevisionOrigin, {
    nullable: true,
    description: 'Источник правки для истории редакций (WEB по умолчанию, CLI для blago)',
  })
  @IsOptional()
  @IsEnum(ContentRevisionOrigin, { message: validationMessage('capital.editProjectInput.origin.invalid') })
  origin?: ContentRevisionOrigin;
}
