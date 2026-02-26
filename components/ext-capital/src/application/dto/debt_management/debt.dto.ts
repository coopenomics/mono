import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { DebtStatus } from '../../../domain/enums/debt-status.enum';
import { DocumentAggregateDTO } from '~/application/document/dto/document-aggregate.dto';
import { BaseOutputDTO } from '~/shared/dto/base.dto';

/**
 * GraphQL Output DTO для сущности Debt
 */
@ObjectType('CapitalDebt', {
  description: 'Долг в системе CAPITAL',
})
export class DebtOutputDTO extends BaseOutputDTO {
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

  @Field(() => DebtStatus, {
    description: 'Статус долга',
  })
  status!: DebtStatus;

  @Field(() => String, {
    description: 'Хеш долга',
  })
  debt_hash!: string;

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

  @Field(() => String, {
    nullable: true,
    description: 'Дата погашения',
  })
  repaid_at?: string;

  @Field(() => Float, {
    nullable: true,
    description: 'Сумма долга',
  })
  amount?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Мемо/комментарий',
  })
  memo?: string;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Заявление на получение ссуды',
  })
  statement?: DocumentAggregateDTO;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Одобренное заявление',
  })
  approved_statement?: DocumentAggregateDTO;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Протокол решения совета',
  })
  authorization?: DocumentAggregateDTO;
}
