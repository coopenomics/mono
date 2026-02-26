import { InputType, Field } from '@nestjs/graphql';
import { ProjectStatus } from '../../../domain/enums/project-status.enum';
import { IssueStatus } from '../../../domain/enums/issue-status.enum';
import { IssuePriority } from '../../../domain/enums/issue-priority.enum';

/**
 * Input DTO для фильтрации проектов
 */
@InputType('CapitalProjectFilter', {
  description: 'Параметры фильтрации для запросов проектов CAPITAL',
})
export class ProjectFilterInputDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по названию кооператива',
  })
  coopname?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по мастеру проекта',
  })
  master?: string;

  @Field(() => [ProjectStatus], {
    nullable: true,
    description: 'Фильтр по статусам проектов',
  })
  statuses?: ProjectStatus[];

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по хешу проекта',
  })
  project_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по хешу родительского проекта',
  })
  parent_hash?: string;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Фильтр по открытому проекту',
  })
  is_opened?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Фильтр по запланированному проекту',
  })
  is_planed?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Показывать только проекты, у которых есть или были голосования',
  })
  has_voting?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Показывать только проекты, у которых есть установленное значение в поле invite',
  })
  has_invite?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'true - только компоненты проектов, false - только основные проекты',
  })
  is_component?: boolean;

  @Field(() => [IssueStatus], {
    nullable: true,
    description: 'Показывать только проекты, у которых есть задачи в указанных статусах',
  })
  has_issues_with_statuses?: IssueStatus[];

  @Field(() => [IssuePriority], {
    nullable: true,
    description: 'Показывать только проекты, у которых есть задачи с указанными приоритетами',
  })
  has_issues_with_priorities?: IssuePriority[];

  @Field(() => [String], {
    nullable: true,
    description: 'Показывать только проекты, у которых есть задачи, созданные указанными пользователями по username',
  })
  has_issues_with_creators?: string[];
}
