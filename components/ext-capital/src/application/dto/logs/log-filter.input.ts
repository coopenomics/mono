import { InputType, Field } from '@nestjs/graphql';
import { LogEventType } from '../../../domain/enums/log-event-type.enum';

/**
 * GraphQL Input DTO для фильтрации логов
 */
@InputType('CapitalLogFilterInput', {
  description: 'Фильтр для поиска логов событий',
})
export class LogFilterInputDTO {
  @Field(() => String, {
    description: 'Название кооператива',
    nullable: true,
  })
  coopname?: string;

  @Field(() => String, {
    description: 'Хеш проекта или компонента',
    nullable: true,
  })
  project_hash?: string;

  @Field(() => String, {
    description: 'Хеш задачи',
    nullable: true,
  })
  issue_hash?: string;

  @Field(() => Boolean, {
    description: 'Показывать логи по задачам',
    nullable: true,
    defaultValue: true,
  })
  show_issue_logs?: boolean;

  @Field(() => [LogEventType], {
    description: 'Типы событий для фильтрации',
    nullable: true,
  })
  event_types?: LogEventType[];

  @Field(() => String, {
    description: 'Инициатор действия (username)',
    nullable: true,
  })
  initiator?: string;

  @Field(() => Date, {
    description: 'Период с',
    nullable: true,
  })
  date_from?: Date;

  @Field(() => Date, {
    description: 'Период по',
    nullable: true,
  })
  date_to?: Date;

  @Field(() => Boolean, {
    description: 'Включать логи дочерних компонентов при фильтрации по project_hash',
    nullable: true,
    defaultValue: true,
  })
  show_components_logs?: boolean;
}
