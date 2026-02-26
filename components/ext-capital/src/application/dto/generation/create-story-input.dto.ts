import { Field, InputType, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsEnum, Min } from 'class-validator';
import { StoryStatus } from '../../../domain/enums/story-status.enum';

/**
 * GraphQL Input DTO для создания истории
 */
@InputType('CreateStoryInput')
export class CreateStoryInputDTO {
  @Field(() => String, {
    description: 'Хеш истории для внешних ссылок',
  })
  @IsNotEmpty({ message: 'Хеш истории не должен быть пустым' })
  @IsString({ message: 'Хеш истории должен быть строкой' })
  story_hash!: string;

  @Field(() => String, {
    description: 'Имя аккаунта кооператива',
  })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, {
    description: 'Название истории',
  })
  @IsNotEmpty({ message: 'Название истории не должно быть пустым' })
  @IsString({ message: 'Название истории должно быть строкой' })
  title!: string;

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
    defaultValue: StoryStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(StoryStatus, { message: 'Неверный статус истории' })
  status?: StoryStatus;

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
    defaultValue: 0,
  })
  @IsOptional()
  @Min(0, { message: 'Порядок сортировки не может быть отрицательным' })
  sort_order?: number;
}
