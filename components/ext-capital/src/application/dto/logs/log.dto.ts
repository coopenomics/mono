import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';
import { LogEventType } from '../../../domain/enums/log-event-type.enum';
import { LogEntityType } from '../../../application/services/mutation-log-mapper.service';
import GraphQLJSON from 'graphql-type-json';

// Регистрируем enum для GraphQL
registerEnumType(LogEventType, {
  name: 'LogEventType',
  description: 'Типы событий в системе логирования',
});

registerEnumType(LogEntityType, {
  name: 'LogEntityType',
  description: 'Типы сущностей в логах',
});

/**
 * GraphQL Output DTO для лога событий
 */
@ObjectType('CapitalLog', {
  description: 'Запись лога событий в системе капитала',
})
export class LogOutputDTO {
  @Field(() => String, {
    description: 'Внутренний идентификатор',
  })
  _id!: string;

  @Field(() => String, {
    description: 'Название кооператива',
  })
  coopname!: string;

  @Field(() => String, {
    description: 'Хеш проекта или компонента',
    nullable: true,
  })
  project_hash?: string;

  @Field(() => LogEntityType, {
    description: 'Тип сущности к которой относится событие',
  })
  entity_type!: LogEntityType;

  @Field(() => String, {
    description: 'ID сущности',
    nullable: true,
  })
  entity_id?: string;

  @Field(() => LogEventType, {
    description: 'Тип события',
  })
  event_type!: LogEventType;

  @Field(() => String, {
    description: 'Инициатор действия (username)',
  })
  initiator!: string;

  @Field(() => String, {
    description: 'Идентификатор-ссылка (invest_hash, commit_hash, result_hash и т.д.)',
    nullable: true,
  })
  reference_id?: string;

  @Field(() => GraphQLJSON, {
    description: 'Вспомогательные данные',
    nullable: true,
  })
  metadata?: Record<string, any>;

  @Field(() => String, {
    description: 'Текстовое описание события',
  })
  message!: string;

  @Field(() => Date, {
    description: 'Дата создания записи',
  })
  created_at!: Date;
}
