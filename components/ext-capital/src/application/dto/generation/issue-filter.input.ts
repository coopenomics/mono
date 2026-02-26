import { InputType, Field } from '@nestjs/graphql';
import { IssuePriority } from '../../../domain/enums/issue-priority.enum';
import { IssueStatus } from '../../../domain/enums/issue-status.enum';

/**
 * Input DTO для фильтрации задач
 */
@InputType('CapitalIssueFilter', {
  description: 'Параметры фильтрации для запросов задач CAPITAL',
})
export class IssueFilterInputDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по имени аккаунта кооператива',
  })
  coopname?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по названию задачи',
  })
  title?: string;

  @Field(() => [IssuePriority], {
    nullable: true,
    description: 'Фильтр по приоритетам задач',
  })
  priorities?: IssuePriority[];

  @Field(() => [IssueStatus], {
    nullable: true,
    description: 'Фильтр по статусам задач',
  })
  statuses?: IssueStatus[];

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по хешу проекта',
  })
  project_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по ID создателя',
  })
  created_by?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по имени пользователя ответственного',
  })
  submaster?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по ID цикла',
  })
  cycle_id?: string;

  @Field(() => [String], {
    nullable: true,
    description: 'Фильтр по массиву имен пользователей создателей',
  })
  creators?: string[];

  @Field(() => String, {
    nullable: true,
    description:
      'Фильтр по имени пользователя мастера проекта (показывать только задачи проектов, где указанный пользователь является мастером)',
  })
  master?: string;
}
