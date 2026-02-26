import { ObjectType, InputType, Field } from '@nestjs/graphql';
import { ProjectTimeStatsOutputDTO } from './project-time-stats.dto';

/**
 * GraphQL Input DTO для гибкого запроса статистики времени
 */
@InputType('CapitalTimeStatsInput', {
  description: 'Входные данные для гибкого запроса статистики времени',
})
export class TimeStatsInputDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Хеш участника (опционально)',
  })
  contributor_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш проекта (опционально)',
  })
  project_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Название кооператива (опционально)',
  })
  coopname?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Имя пользователя (опционально)',
  })
  username?: string;
}

/**
 * GraphQL Output DTO для гибкого запроса статистики времени с пагинацией
 */
@ObjectType('CapitalTimeStats', {
  description: 'Результат гибкого запроса статистики времени с пагинацией',
})
export class FlexibleTimeStatsOutputDTO {
  @Field(() => [ProjectTimeStatsOutputDTO], {
    description: 'Список результатов статистики времени',
  })
  items!: ProjectTimeStatsOutputDTO[];

  @Field(() => Number, {
    description: 'Общее количество результатов',
  })
  totalCount!: number;

  @Field(() => Number, {
    description: 'Текущая страница',
  })
  currentPage!: number;

  @Field(() => Number, {
    description: 'Общее количество страниц',
  })
  totalPages!: number;
}
