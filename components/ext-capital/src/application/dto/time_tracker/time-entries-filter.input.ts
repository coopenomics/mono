import { InputType, Field } from '@nestjs/graphql';

/**
 * Input DTO для фильтрации записей времени
 */
@InputType('CapitalTimeEntriesFilter', {
  description: 'Параметры фильтрации для запросов записей времени CAPITAL',
})
export class TimeEntriesFilterInputDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Хеш проекта (опционально, если не указан - вернёт записи по всем проектам)',
  })
  project_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш участника (опционально, если не указан - вернёт записи всех участников проекта)',
  })
  contributor_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш задачи (опционально, если не указан - вернёт записи по всем задачам)',
  })
  issue_hash?: string;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Фильтр по закоммиченным записям (опционально)',
  })
  is_committed?: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по названию кооператива',
  })
  coopname?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по имени пользователя',
  })
  username?: string;
}
