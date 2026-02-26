import { ObjectType, Field, Float } from '@nestjs/graphql';

/**
 * GraphQL Output DTO для записи времени
 */
@ObjectType('CapitalTimeEntry', {
  description: 'Запись времени участника',
})
export class TimeEntryOutputDTO {
  @Field(() => String, {
    description: 'Уникальный идентификатор записи',
  })
  _id!: string;

  @Field(() => String, {
    description: 'Хеш участника',
  })
  contributor_hash!: string;

  @Field(() => String, {
    description: 'Хеш задачи',
  })
  issue_hash!: string;

  @Field(() => String, {
    description: 'Хеш проекта',
  })
  project_hash!: string;

  @Field(() => String, {
    description: 'Название кооператива',
  })
  coopname!: string;

  @Field(() => String, {
    description: 'Дата записи времени (YYYY-MM-DD)',
  })
  date!: string;

  @Field(() => Float, {
    description: 'Количество часов',
  })
  hours!: number;

  @Field(() => String, {
    description: 'Хеш коммита',
    nullable: true,
  })
  commit_hash?: string;

  @Field(() => Boolean, {
    description: 'Флаг, указывающий, закоммичена ли запись',
  })
  is_committed!: boolean;

  @Field(() => String, {
    description: 'Тип начисления времени: hourly (почасовое) или estimate (по завершению задачи)',
    nullable: true,
  })
  entry_type?: string;

  @Field(() => Float, {
    description: 'Снимок estimate на момент начисления времени (для отслеживания изменений)',
    nullable: true,
  })
  estimate_snapshot?: number;

  @Field(() => String, {
    description: 'Дата создания записи',
  })
  _created_at!: string;

  @Field(() => String, {
    description: 'Дата последнего обновления записи',
  })
  _updated_at!: string;
}
