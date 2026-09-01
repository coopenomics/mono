import { Field, InputType, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsEnum, Min, IsInt } from 'class-validator';
import { ContentRevisionOrigin } from '../../../domain/enums/content-revision-origin.enum';
import { StoryStatus } from '../../../domain/enums/story-status.enum';
import { StoryContentFormat } from '../../../domain/enums/story-content-format.enum';

/**
 * GraphQL Input DTO для обновления истории
 */
@InputType('UpdateStoryInput')
export class UpdateStoryInputDTO {
  @Field(() => String, {
    description: 'Хэш истории для обновления',
  })
  @IsNotEmpty({ message: 'Хэш истории не должен быть пустым' })
  @IsString({ message: 'Хэш истории должен быть строкой' })
  story_hash!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Название истории',
  })
  @IsOptional()
  @IsString({ message: 'Название истории должно быть строкой' })
  title?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Описание истории',
  })
  @IsOptional()
  @IsString({ message: 'Описание истории должно быть строкой' })
  description?: string;

  @Field(() => StoryStatus, {
    nullable: true,
    description: 'Статус истории',
  })
  @IsOptional()
  @IsEnum(StoryStatus, { message: 'Неверный статус истории' })
  status?: StoryStatus;

  @Field(() => StoryContentFormat, {
    nullable: true,
    description: 'Формат тела требования (MARKDOWN, BPMN, DRAWIO, MERMAID)',
  })
  @IsOptional()
  @IsEnum(StoryContentFormat, { message: 'Неверный формат содержимого истории' })
  content_format?: StoryContentFormat;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш проекта (если история привязана к проекту)',
  })
  @IsOptional()
  @IsString({ message: 'Хеш проекта должен быть строкой' })
  project_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш задачи (если история привязана к задаче)',
  })
  @IsOptional()
  @IsString({ message: 'Хеш задачи должен быть строкой' })
  issue_hash?: string;

  @Field(() => Int, {
    nullable: true,
    description: 'Порядок сортировки',
  })
  @IsOptional()
  @Min(0, { message: 'Порядок сортировки не может быть отрицательным' })
  sort_order?: number;

  @Field(() => Int, {
    nullable: true,
    description:
      'Редакция содержимого (content_rev), с которой автор начал правку. Сервер сливает правку с параллельными изменениями; без поля — запись без проверки версии',
  })
  @IsOptional()
  @IsInt({ message: 'base_rev должен быть целым числом' })
  @Min(0, { message: 'base_rev не может быть отрицательным' })
  base_rev?: number;

  @Field(() => ContentRevisionOrigin, {
    nullable: true,
    description: 'Источник правки для истории редакций (WEB по умолчанию, CLI для blago)',
  })
  @IsOptional()
  @IsEnum(ContentRevisionOrigin, { message: 'Неверный источник правки' })
  origin?: ContentRevisionOrigin;
}
