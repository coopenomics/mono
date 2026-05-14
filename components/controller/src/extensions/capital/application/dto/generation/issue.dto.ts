import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { IssuePriority } from '../../../domain/enums/issue-priority.enum';
import { IssueStatus } from '../../../domain/enums/issue-status.enum';
import GraphQLJSON from 'graphql-type-json';
import { BaseOutputDTO } from '~/shared/dto/base.dto';
import { IssuePermissionsOutputDTO } from './issue-permissions.dto';

@ObjectType('CapitalIssueLinkedGitCommit', {
  description: 'Индексированный Git-коммит, привязанный к задаче (PRD 78 / маркеры в сообщении)',
})
export class IssueLinkedGitCommitSummaryDTO {
  @Field(() => String)
  github_sha!: string;

  @Field(() => String)
  html_url!: string;

  @Field(() => String)
  username!: string;

  @Field(() => Date)
  committed_at!: Date;

  @Field(() => Boolean)
  consumed!: boolean;

  /** Полный текст сообщения коммита (маркеры PRD / формат) */
  @Field(() => String)
  commit_message!: string;
}

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

  @Field(() => Float, {
    description: 'Оценка в часах (допускаются дроби, например 1.5)',
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

  @Field(() => [IssueLinkedGitCommitSummaryDTO], {
    description:
      'Git-коммиты ветки с валидными маркерами, привязанные к этой задаче (пустой массив, если привязок нет)',
  })
  linked_git_commits!: IssueLinkedGitCommitSummaryDTO[];

  @Field(() => Float, {
    description:
      'Фактически накопленное время по задаче в часах — сумма всех TimeEntry (committed + uncommitted). Read-only, считается на лету',
  })
  fact!: number;

  @Field(() => Float, {
    description: 'Часть факта, уже зафиксированная в capital-коммитах (is_committed=true)',
  })
  fact_committed!: number;

  @Field(() => Float, {
    description: 'Часть факта, ещё не зафиксированная в capital-коммитах',
  })
  fact_uncommitted!: number;

  @Field(() => [ContributorFactDTO], {
    description: 'Разбивка факта по исполнителям — сколько часов накопил каждый contributor по этой задаче',
  })
  fact_by_contributor!: ContributorFactDTO[];
}

@ObjectType('CapitalIssueContributorFact', {
  description: 'Часы, накопленные одним исполнителем по задаче',
})
export class ContributorFactDTO {
  @Field(() => String, { description: 'Хеш исполнителя' })
  contributor_hash!: string;

  @Field(() => Float, { description: 'Суммарные часы (committed + uncommitted)' })
  hours!: number;
}
