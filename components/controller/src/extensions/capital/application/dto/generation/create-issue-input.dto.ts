import { Field, InputType, Int, Float } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString, IsOptional, IsEnum, Min, IsArray, IsNumber } from 'class-validator';
import { IssuePriority } from '../../../domain/enums/issue-priority.enum';
import { IssueStatus } from '../../../domain/enums/issue-status.enum';

/**
 * GraphQL Input DTO для создания задачи
 */
@InputType('CreateIssueInput')
export class CreateIssueInputDTO {
  @Field(() => String, {
    description: 'Имя аккаунта кооператива',
  })
  @IsNotEmpty({ message: validationMessage('capital.createIssueInput.coopname.required') })
  @IsString({ message: validationMessage('capital.createIssueInput.coopname.string') })
  coopname!: string;

  @Field(() => String, {
    description: 'Название задачи',
  })
  @IsNotEmpty({ message: validationMessage('capital.createIssueInput.title.required') })
  @IsString({ message: validationMessage('capital.createIssueInput.title.string') })
  title!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Описание задачи',
  })
  @IsOptional()
  @IsString({ message: validationMessage('capital.createIssueInput.description.string') })
  description?: string;

  @Field(() => IssuePriority, {
    nullable: true,
    description: 'Приоритет задачи',
    defaultValue: IssuePriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(IssuePriority, { message: validationMessage('capital.createIssueInput.priority.invalid') })
  priority?: IssuePriority;

  @Field(() => IssueStatus, {
    nullable: true,
    description: 'Статус задачи',
    defaultValue: IssueStatus.BACKLOG,
  })
  @IsOptional()
  @IsEnum(IssueStatus, { message: validationMessage('capital.createIssueInput.status.invalid') })
  status?: IssueStatus;

  @Field(() => Float, {
    nullable: true,
    description: 'Оценка в часах (допускаются дроби)',
    defaultValue: 0,
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: validationMessage('capital.createIssueInput.estimate.number') })
  @Min(0, { message: validationMessage('capital.createIssueInput.estimate.min') })
  estimate?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Порядок сортировки',
    defaultValue: 0,
  })
  @IsOptional()
  @Min(0, { message: validationMessage('capital.createIssueInput.sortOrder.min') })
  sort_order?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Имя пользователя ответственного (contributor)',
  })
  @IsOptional()
  @IsString({ message: validationMessage('capital.createIssueInput.submaster.string') })
  submaster?: string;

  @Field(() => [String], {
    nullable: true,
    description:
      'Массив имён соисполнителей (contributors); может быть пустым. Первый элемент при сохранении становится ответственным (submaster), если submaster не задан явно.',
  })
  @IsOptional()
  @IsArray({ message: validationMessage('capital.createIssueInput.creators.arrayOfStrings') })
  creators?: string[];

  @Field(() => String, {
    nullable: true,
    description:
      'Хеш проекта или компонента. Если не указан — свободная задача без привязки к проекту',
  })
  @IsOptional()
  @IsString({ message: validationMessage('capital.createIssueInput.projectHash.string') })
  project_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'ID цикла',
  })
  @IsOptional()
  @IsString({ message: validationMessage('capital.createIssueInput.cycleId.string') })
  cycle_id?: string;

  @Field(() => [String], {
    nullable: true,
    description: 'Метки задачи',
  })
  @IsOptional()
  @IsArray({ message: validationMessage('capital.createIssueInput.labels.arrayOfStrings') })
  labels?: string[];

  @Field(() => [String], {
    nullable: true,
    description: 'Вложения задачи',
  })
  @IsOptional()
  @IsArray({ message: validationMessage('capital.createIssueInput.attachments.arrayOfStrings') })
  attachments?: string[];
}
