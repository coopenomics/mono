import { ObjectType, Field, Int } from '@nestjs/graphql';
import { ProgramPropertyStatus } from '../../../domain/enums/program-property-status.enum';
import { BaseOutputDTO } from '@coopenomics/extension-kit/sync';
import { DocumentAggregateDTO } from '@coopenomics/extension-kit';

/**
 * GraphQL Output DTO для сущности ProgramProperty
 */
@ObjectType('CapitalProgramProperty', {
  description: 'Паевой взнос имуществом в программу «Благорост»',
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
    description: 'Статус паевого взноса имуществом',
  })
  status!: ProgramPropertyStatus;

  @Field(() => String, {
    description: 'Идентификатор паевого взноса имуществом',
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

  @Field(() => String, {
    nullable: true,
    description: 'Оценочная стоимость имущества',
  })
  property_amount?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Описание имущества, как оно записано в цепи',
  })
  property_description?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Наименование имущества из заявления',
  })
  property_name?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Описание, характеристики и состояние имущества из заявления',
  })
  property_details?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Количество из заявления',
  })
  property_quantity?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Единица измерения из заявления',
  })
  property_unit?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Дата создания',
  })
  created_at?: string;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Заявление пайщика о паевом взносе имуществом',
  })
  statement?: DocumentAggregateDTO;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Протокол решения совета о приёме имущества',
  })
  authorization?: DocumentAggregateDTO;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Акт приёма-передачи имущества',
  })
  act?: DocumentAggregateDTO;
}
