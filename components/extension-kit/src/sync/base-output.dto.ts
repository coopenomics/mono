import { ObjectType, Field } from '@nestjs/graphql';

/**
 * Базовый GraphQL Output DTO для сущностей
 */
@ObjectType('BaseEntity', {
  description: 'Базовые поля сущности',
})
export class BaseOutputDTO {
  @Field(() => String, {
    description: 'Внутренний ID базы данных',
  })
  _id!: string;

  @Field(() => Boolean, {
    description: 'Флаг присутствия записи в блокчейне',
  })
  present!: boolean;

  @Field(() => Number, {
    nullable: true,
    description: 'Номер блока крайней синхронизации с блокчейном',
  })
  block_num?: number;

  @Field(() => Date, {
    description: 'Дата создания записи',
  })
  _created_at!: Date;

  @Field(() => Date, {
    description: 'Дата последнего обновления записи',
  })
  _updated_at!: Date;
}
