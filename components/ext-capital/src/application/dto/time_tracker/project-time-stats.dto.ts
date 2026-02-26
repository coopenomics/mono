import { ObjectType, InputType, Field, Float } from '@nestjs/graphql';

/**
 * GraphQL Output DTO для статистики времени по проекту участника
 */
@ObjectType('CapitalProjectTimeStats', {
  description: 'Статистика времени участника по проекту',
})
export class ProjectTimeStatsOutputDTO {
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

  @Field(() => Float, {
    description: 'Сумма закоммиченного времени (часы)',
  })
  total_committed_hours!: number;

  @Field(() => Float, {
    description: 'Сумма незакоммиченного времени (часы)',
  })
  total_uncommitted_hours!: number;

  @Field(() => Float, {
    description: 'Доступное время для коммита (по завершённым задачам)',
  })
  available_hours!: number;

  @Field(() => Float, {
    description: 'Время в ожидании (по незавершённым задачам)',
  })
  pending_hours!: number;
}

/**
 * GraphQL Input DTO для запроса списка проектов с статистикой времени участника
 */
@InputType('CapitalContributorProjectsTimeStatsInput', {
  description: 'Входные данные для запроса списка проектов с статистикой времени участника',
})
export class ContributorProjectsTimeStatsInputDTO {
  @Field(() => String, {
    description: 'Хеш участника',
  })
  contributor_hash!: string;
}

/**
 * GraphQL Output DTO для списка проектов с статистикой времени участника
 */
@ObjectType('CapitalContributorProjectsTimeStats', {
  description: 'Список проектов с статистикой времени участника',
})
export class ContributorProjectsTimeStatsOutputDTO {
  @Field(() => String, {
    description: 'Хеш участника',
  })
  contributor_hash!: string;

  @Field(() => [ProjectTimeStatsOutputDTO], {
    description: 'Список проектов с статистикой времени',
  })
  projects!: ProjectTimeStatsOutputDTO[];
}
