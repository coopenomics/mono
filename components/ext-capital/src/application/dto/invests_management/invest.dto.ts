import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { InvestStatus } from '../../../domain/enums/invest-status.enum';
import { BaseOutputDTO } from '~/shared/dto/base.dto';

/**
 * GraphQL Output DTO для сущности Invest
 */
@ObjectType('CapitalInvest', {
  description: 'Инвестиция в системе CAPITAL',
})
export class InvestOutputDTO extends BaseOutputDTO {
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

  @Field(() => InvestStatus, {
    description: 'Статус инвестиции',
  })
  status!: InvestStatus;

  @Field(() => String, {
    description: 'Хеш инвестиции',
  })
  invest_hash!: string;

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
    description: 'Хеш проекта',
  })
  project_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Статус из блокчейна',
  })
  blockchain_status?: string;

  @Field(() => Float, {
    nullable: true,
    description: 'Сумма инвестиции',
  })
  amount?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Дата инвестирования',
  })
  invested_at?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Заявление',
  })
  statement?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Координатор',
  })
  coordinator?: string;

  @Field(() => Float, {
    nullable: true,
    description: 'Сумма координатора',
  })
  coordinator_amount?: number;
}
