import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { ProgramWithdrawStatus } from '../../../domain/enums/program-withdraw-status.enum';
import { DocumentAggregateDTO } from '~/application/document/dto/document-aggregate.dto';
import { BaseOutputDTO } from '~/shared/dto/base.dto';

/**
 * GraphQL Output DTO для сущности ProgramWithdraw
 */
@ObjectType('CapitalProgramWithdraw', {
  description: 'Возврат из программы в системе CAPITAL',
})
export class ProgramWithdrawOutputDTO extends BaseOutputDTO {
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

  @Field(() => ProgramWithdrawStatus, {
    description: 'Статус возврата из программы',
  })
  status!: ProgramWithdrawStatus;

  @Field(() => String, {
    description: 'Хеш возврата',
  })
  withdraw_hash!: string;

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
    description: 'Сумма возврата',
  })
  amount?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Дата создания',
  })
  created_at?: string;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Заявление о возврате',
  })
  statement?: DocumentAggregateDTO;
}
