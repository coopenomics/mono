import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { ProgramPropertyStatus } from '../../../domain/enums/program-property-status.enum';
import { DocumentAggregateDTO } from '~/application/document/dto/document-aggregate.dto';
import { BaseOutputDTO } from '~/shared/dto/base.dto';

/**
 * GraphQL Output DTO для сущности ProgramProperty
 */
@ObjectType('CapitalProgramProperty', {
  description: 'Программный имущественный взнос в системе CAPITAL',
})
export class ProgramPropertyOutputDTO extends BaseOutputDTO {
  @Field(() => Int, {
    nullable: true,
    description: 'ID в блокчейне',
  })
  id?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Номер блока последнего обновления',
  })
  block_num?: number;

  @Field(() => Boolean, {
    description: 'Существует ли запись в блокчейне',
    defaultValue: false,
  })
  present!: boolean;

  @Field(() => ProgramPropertyStatus, {
    description: 'Статус программного имущественного взноса',
  })
  status!: ProgramPropertyStatus;

  @Field(() => String, {
    description: 'Хеш имущественного взноса',
  })
  property_hash!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Название кооператива',
  })
  coopname?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Имя пользователя',
  })
  username?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Статус из блокчейна',
  })
  blockchain_status?: string;

  @Field(() => Float, {
    nullable: true,
    description: 'Количество имущества',
  })
  property_amount?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Описание имущества',
  })
  property_description?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Дата создания',
  })
  created_at?: string;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Заявление об имущественном взносе',
  })
  statement?: DocumentAggregateDTO;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Авторизация имущественного взноса',
  })
  authorization?: DocumentAggregateDTO;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Акт об имущественном взносе',
  })
  act?: DocumentAggregateDTO;
}
