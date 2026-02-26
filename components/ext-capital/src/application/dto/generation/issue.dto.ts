import { ObjectType, Field, Int } from '@nestjs/graphql';
import { IssuePriority } from '../../../domain/enums/issue-priority.enum';
import { IssueStatus } from '../../../domain/enums/issue-status.enum';
import GraphQLJSON from 'graphql-type-json';
import { BaseOutputDTO } from '~/shared/dto/base.dto';
import { IssuePermissionsOutputDTO } from './issue-permissions.dto';

/**
 * GraphQL Output DTO для сущности Issue
 */
@ObjectType('CapitalIssue', {
  description: 'Задача в системе CAPITAL',
})
export class IssueOutputDTO extends BaseOutputDTO {
  @Field(() => String, {
    description: 'Уникальный ID задачи в формате PREFIX-N (например, ABC-1)',
  })
  id!: string;

  @Field(() => String, {
    description: 'Хеш задачи',
  })
  issue_hash!: string;

  @Field(() => String, {
    description: 'Название задачи',
  })
  title!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Описание задачи',
  })
  description?: string;

  @Field(() => IssuePriority, {
    description: 'Приоритет задачи',
  })
  priority!: IssuePriority;

  @Field(() => IssueStatus, {
    description: 'Статус задачи',
  })
  status!: IssueStatus;

  @Field(() => Int, {
    description: 'Оценка в story points или часах',
  })
  estimate!: number;

  @Field(() => Int, {
    description: 'Порядок сортировки',
  })
  sort_order!: number;

  @Field(() => String, {
    description: 'Имя пользователя, создавшего задачу',
  })
  created_by!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Имя пользователя ответственного (contributor)',
  })
  submaster?: string;

  @Field(() => [String], {
    description: 'Массив имен пользователей создателей (contributors)',
  })
  creators!: string[];

  @Field(() => String, {
    description: 'Хеш проекта',
  })
  project_hash!: string;

  @Field(() => String, {
    nullable: true,
    description: 'ID цикла',
  })
  cycle_id?: string;

  @Field(() => GraphQLJSON, {
    description: 'Метаданные задачи',
  })
  metadata!: {
    labels: string[];
    attachments: string[];
  };

  @Field(() => IssuePermissionsOutputDTO, {
    description: 'Права доступа текущего пользователя к задаче',
  })
  permissions?: IssuePermissionsOutputDTO;
}
