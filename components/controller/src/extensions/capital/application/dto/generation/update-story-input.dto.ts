import { Field, InputType, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsEnum, Min, IsInt } from 'class-validator';
import { ContentRevisionOrigin } from '../../../domain/enums/content-revision-origin.enum';
import { StoryStatus } from '../../../domain/enums/story-status.enum';
import { StoryContentFormat } from '../../../domain/enums/story-content-format.enum';
import { t } from '../../../i18n';

/**
 * GraphQL Input DTO для обновления истории
 */
@InputType('UpdateStoryInput')
export class UpdateStoryInputDTO {
  @Field(() => String, {
    description: 'Хэш истории для обновления',
  })
  @IsNotEmpty({ message: t('capital.updateStoryInput.storyHash.required') })
  @IsString({ message: t('capital.updateStoryInput.storyHash.string') })
  story_hash!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Название истории',
  })
  @IsOptional()
  @IsString({ message: t('capital.updateStoryInput.title.string') })
  title?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Описание истории',
  })
  @IsOptional()
  @IsString({ message: t('capital.updateStoryInput.description.string') })
  description?: string;

  @Field(() => StoryStatus, {
    nullable: true,
    description: 'Статус истории',
  })
  @IsOptional()
  @IsEnum(StoryStatus, { message: t('capital.updateStoryInput.status.invalid') })
  status?: StoryStatus;

  @Field(() => StoryContentFormat, {
    nullable: true,
    description: 'Формат тела требования (MARKDOWN, BPMN, DRAWIO, MERMAID)',
  })
  @IsOptional()
  @IsEnum(StoryContentFormat, { message: t('capital.updateStoryInput.contentFormat.invalid') })
  content_format?: StoryContentFormat;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш проекта (если история привязана к проекту)',
  })
  @IsOptional()
  @IsString({ message: t('capital.updateStoryInput.projectHash.string') })
  project_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш задачи (если история привязана к задаче)',
  })
  @IsOptional()
  @IsString({ message: t('capital.updateStoryInput.issueHash.string') })
  issue_hash?: string;

  @Field(() => Int, {
    nullable: true,
    description: 'Порядок сортировки',
  })
  @IsOptional()
  @Min(0, { message: t('capital.updateStoryInput.sortOrder.min') })
  sort_order?: number;

  @Field(() => Int, {
    nullable: true,
    description:
      'Редакция содержимого (content_rev), с которой автор начал правку. Сервер сливает правку с параллельными изменениями; без поля — запись без проверки версии',
  })
  @IsOptional()
  @IsInt({ message: t('capital.updateStoryInput.baseRev.int') })
  @Min(0, { message: t('capital.updateStoryInput.baseRev.min') })
  base_rev?: number;

  @Field(() => ContentRevisionOrigin, {
    nullable: true,
    description: 'Источник правки для истории редакций (WEB по умолчанию, CLI для blago)',
  })
  @IsOptional()
  @IsEnum(ContentRevisionOrigin, { message: t('capital.updateStoryInput.origin.invalid') })
  origin?: ContentRevisionOrigin;
}
