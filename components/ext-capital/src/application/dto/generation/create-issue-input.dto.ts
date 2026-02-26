import { Field, InputType, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsEnum, Min, IsArray, ArrayNotEmpty } from 'class-validator';
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
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, {
    description: 'Название задачи',
  })
  @IsNotEmpty({ message: 'Название задачи не должно быть пустым' })
  @IsString({ message: 'Название задачи должно быть строкой' })
  title!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Описание задачи',
  })
  @IsOptional()
  @IsString({ message: 'Описание задачи должно быть строкой' })
  description?: string;

  @Field(() => IssuePriority, {
    nullable: true,
    description: 'Приоритет задачи',
    defaultValue: IssuePriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(IssuePriority, { message: 'Неверный приоритет задачи' })
  priority?: IssuePriority;

  @Field(() => IssueStatus, {
    nullable: true,
    description: 'Статус задачи',
    defaultValue: IssueStatus.BACKLOG,
  })
  @IsOptional()
  @IsEnum(IssueStatus, { message: 'Неверный статус задачи' })
  status?: IssueStatus;

  @Field(() => Int, {
    nullable: true,
    description: 'Оценка в story points или часах',
    defaultValue: 0,
  })
  @IsOptional()
  @Min(0, { message: 'Оценка не может быть отрицательной' })
  estimate?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Порядок сортировки',
    defaultValue: 0,
  })
  @IsOptional()
  @Min(0, { message: 'Порядок сортировки не может быть отрицательным' })
  sort_order?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Имя пользователя ответственного (contributor)',
  })
  @IsOptional()
  @IsString({ message: 'Имя пользователя ответственного должно быть строкой' })
  submaster?: string;

  @Field(() => [String], {
    nullable: true,
    description: 'Массив имен пользователей создателей (contributors)',
  })
  @IsOptional()
  @IsArray({ message: 'Создатели должны быть массивом строк' })
  @ArrayNotEmpty({ message: 'Массив создателей не должен быть пустым' })
  creators?: string[];

  @Field(() => String, {
    description: 'Хеш проекта',
  })
  @IsNotEmpty({ message: 'Хеш проекта не должен быть пустым' })
  @IsString({ message: 'Хеш проекта должен быть строкой' })
  project_hash!: string;

  @Field(() => String, {
    nullable: true,
    description: 'ID цикла',
  })
  @IsOptional()
  @IsString({ message: 'ID цикла должен быть строкой' })
  cycle_id?: string;

  @Field(() => [String], {
    nullable: true,
    description: 'Метки задачи',
  })
  @IsOptional()
  @IsArray({ message: 'Метки должны быть массивом строк' })
  labels?: string[];

  @Field(() => [String], {
    nullable: true,
    description: 'Вложения задачи',
  })
  @IsOptional()
  @IsArray({ message: 'Вложения должны быть массивом строк' })
  attachments?: string[];
}
