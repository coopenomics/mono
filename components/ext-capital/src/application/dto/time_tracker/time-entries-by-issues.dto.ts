import { ObjectType, Field, Float } from '@nestjs/graphql';

/**
 * GraphQL Output DTO для агрегированной статистики времени по задачам
 */
@ObjectType('CapitalTimeEntriesByIssues', {
  description: 'Агрегированная статистика времени по задачам с информацией о задачах и участниках',
})
export class TimeEntriesByIssuesOutputDTO {
  @Field(() => String, {
    description: 'Хеш задачи',
  })
  issue_hash!: string;

  @Field(() => String, {
    description: 'Название задачи',
  })
  issue_title!: string;

  @Field(() => String, {
    description: 'Хеш проекта',
  })
  project_hash!: string;

  @Field(() => String, {
    description: 'Название проекта',
  })
  project_name!: string;

  @Field(() => String, {
    description: 'Хеш участника',
  })
  contributor_hash!: string;

  @Field(() => String, {
    description: 'Имя участника',
  })
  contributor_name!: string;

  @Field(() => String, {
    description: 'Название кооператива',
  })
  coopname!: string;

  @Field(() => Float, {
    description: 'Общее количество часов по задаче',
  })
  total_hours!: number;

  @Field(() => Float, {
    description: 'Количество закоммиченных часов',
  })
  committed_hours!: number;

  @Field(() => Float, {
    description: 'Количество незакоммиченных часов',
  })
  uncommitted_hours!: number;

  @Field(() => Float, {
    description: 'Доступное время для коммита (по завершённым задачам)',
  })
  available_hours!: number;

  @Field(() => Float, {
    description: 'Время в ожидании (по незавершённым задачам)',
  })
  pending_hours!: number;
}
