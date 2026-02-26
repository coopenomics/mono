import { ObjectType, InputType, Field, Float } from '@nestjs/graphql';

/**
 * GraphQL Output DTO для статистики времени участника по проекту
 */
@ObjectType('CapitalTimeStats', {
  description: 'Статистика времени участника по проекту',
})
export class TimeStatsOutputDTO {
  @Field(() => String, {
    description: 'Хеш участника',
  })
  contributor_hash!: string;

  @Field(() => String, {
    description: 'Хеш проекта',
  })
  project_hash!: string;

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
 * GraphQL Input DTO для запроса статистики времени
 */
@InputType('CapitalTimeStatsInput', {
  description: 'Входные данные для запроса статистики времени',
})
export class TimeStatsInputDTO {
  @Field(() => String, {
    description: 'Хеш участника',
  })
  contributor_hash!: string;

  @Field(() => String, {
    description: 'Хеш проекта',
  })
  project_hash!: string;
}
