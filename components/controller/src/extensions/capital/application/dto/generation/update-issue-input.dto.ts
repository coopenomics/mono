import { Field, InputType, Int, Float } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsEnum, Min, IsArray, IsNumber, IsInt } from 'class-validator';
import { ContentRevisionOrigin } from '../../../domain/enums/content-revision-origin.enum';
import { IssuePriority } from '../../../domain/enums/issue-priority.enum';
import { IssueStatus } from '../../../domain/enums/issue-status.enum';
import { t } from '../../../i18n';

/**
 * GraphQL Input DTO для обновления задачи
 */
@InputType('UpdateIssueInput')
export class UpdateIssueInputDTO {
  @Field(() => String, {
    description: 'Хэш задачи для обновления',
  })
  @IsNotEmpty({ message: t('capital.updateIssueInput.issueHash.required') })
  @IsString({ message: t('capital.updateIssueInput.issueHash.string') })
  issue_hash!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Название задачи',
  })
  @IsOptional()
  @IsString({ message: t('capital.updateIssueInput.title.string') })
  title?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Описание задачи',
  })
  @IsOptional()
  @IsString({ message: t('capital.updateIssueInput.description.string') })
  description?: string;

  @Field(() => IssuePriority, {
    nullable: true,
    description: 'Приоритет задачи',
  })
  @IsOptional()
  @IsEnum(IssuePriority, { message: t('capital.updateIssueInput.priority.invalid') })
  priority?: IssuePriority;

  @Field(() => IssueStatus, {
    nullable: true,
    description: 'Статус задачи',
  })
  @IsOptional()
  @IsEnum(IssueStatus, { message: t('capital.updateIssueInput.status.invalid') })
  status?: IssueStatus;

  @Field(() => Float, {
    nullable: true,
    description: 'Оценка в часах (допускаются дроби)',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: t('capital.updateIssueInput.estimate.number') })
  @Min(0, { message: t('capital.updateIssueInput.estimate.min') })
  estimate?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Порядок сортировки',
  })
  @IsOptional()
  @Min(0, { message: t('capital.updateIssueInput.sortOrder.min') })
  sort_order?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Имя пользователя ответственного (contributor)',
  })
  @IsOptional()
  @IsString({ message: t('capital.updateIssueInput.submaster.string') })
  submaster?: string;

  @Field(() => [String], {
    nullable: true,
    description: 'Массив имен пользователей создателей (contributors)',
  })
  @IsOptional()
  @IsArray({ message: t('capital.updateIssueInput.creators.arrayOfStrings') })
  creators?: string[];

  @Field(() => String, {
    nullable: true,
    description: 'ID цикла',
  })
  @IsOptional()
  @IsString({ message: t('capital.updateIssueInput.cycleId.string') })
  cycle_id?: string;

  @Field(() => [String], {
    nullable: true,
    description: 'Метки задачи',
  })
  @IsOptional()
  @IsArray({ message: t('capital.updateIssueInput.labels.arrayOfStrings') })
  labels?: string[];

  @Field(() => [String], {
    nullable: true,
    description: 'Вложения задачи',
  })
  @IsOptional()
  @IsArray({ message: t('capital.updateIssueInput.attachments.arrayOfStrings') })
  attachments?: string[];

  @Field(() => Int, {
    nullable: true,
    description:
      'Редакция содержимого (content_rev), с которой автор начал правку. Сервер сливает правку с параллельными изменениями; без поля — запись без проверки версии',
  })
  @IsOptional()
  @IsInt({ message: t('capital.updateIssueInput.baseRev.int') })
  @Min(0, { message: t('capital.updateIssueInput.baseRev.min') })
  base_rev?: number;

  @Field(() => ContentRevisionOrigin, {
    nullable: true,
    description: 'Источник правки для истории редакций (WEB по умолчанию, CLI для blago)',
  })
  @IsOptional()
  @IsEnum(ContentRevisionOrigin, { message: t('capital.updateIssueInput.origin.invalid') })
  origin?: ContentRevisionOrigin;
}
