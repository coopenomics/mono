import { Field, InputType, Int } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString, IsOptional, IsEnum, Min } from 'class-validator';
import { StoryStatus } from '../../../domain/enums/story-status.enum';
import { StoryContentFormat } from '../../../domain/enums/story-content-format.enum';

/**
 * GraphQL Input DTO для создания истории
 */
@InputType('CreateStoryInput')
export class CreateStoryInputDTO {
  @Field(() => String, {
    description: 'Хеш истории для внешних ссылок',
  })
  @IsNotEmpty({ message: validationMessage('capital.createStoryInput.storyHash.required') })
  @IsString({ message: validationMessage('capital.createStoryInput.storyHash.string') })
  story_hash!: string;

  @Field(() => String, {
    description: 'Имя аккаунта кооператива',
  })
  @IsNotEmpty({ message: validationMessage('capital.createStoryInput.coopname.required') })
  @IsString({ message: validationMessage('capital.createStoryInput.coopname.string') })
  coopname!: string;

  @Field(() => String, {
    description: 'Название истории',
  })
  @IsNotEmpty({ message: validationMessage('capital.createStoryInput.title.required') })
  @IsString({ message: validationMessage('capital.createStoryInput.title.string') })
  title!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Описание истории',
  })
  @IsOptional()
  @IsString({ message: validationMessage('capital.createStoryInput.description.string') })
  description?: string;

  @Field(() => StoryContentFormat, {
    nullable: true,
    description: 'Формат содержимого; по умолчанию MARKDOWN',
    defaultValue: StoryContentFormat.MARKDOWN,
  })
  @IsOptional()
  @IsEnum(StoryContentFormat, { message: validationMessage('capital.createStoryInput.contentFormat.invalid') })
  content_format?: StoryContentFormat;

  @Field(() => StoryStatus, {
    nullable: true,
    description: 'Статус истории',
    defaultValue: StoryStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(StoryStatus, { message: validationMessage('capital.createStoryInput.status.invalid') })
  status?: StoryStatus;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш проекта (если история привязана к проекту)',
  })
  @IsOptional()
  @IsString({ message: validationMessage('capital.createStoryInput.projectHash.string') })
  project_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш задачи (если история привязана к задаче)',
  })
  @IsOptional()
  @IsString({ message: validationMessage('capital.createStoryInput.issueHash.string') })
  issue_hash?: string;

  @Field(() => Int, {
    nullable: true,
    description: 'Порядок сортировки',
    defaultValue: 0,
  })
  @IsOptional()
  @Min(0, { message: validationMessage('capital.createStoryInput.sortOrder.min') })
  sort_order?: number;
}
