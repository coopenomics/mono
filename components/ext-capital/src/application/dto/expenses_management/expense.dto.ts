import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { ExpenseStatus } from '../../../domain/enums/expense-status.enum';
import { DocumentAggregateDTO } from '~/application/document/dto/document-aggregate.dto';
import { BaseOutputDTO } from '~/shared/dto/base.dto';

/**
 * GraphQL Output DTO для сущности Expense
 */
@ObjectType('CapitalExpense', {
  description: 'Расход в системе CAPITAL',
})
export class ExpenseOutputDTO extends BaseOutputDTO {
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

  @Field(() => ExpenseStatus, {
    description: 'Статус расхода',
  })
  status!: ExpenseStatus;

  @Field(() => String, {
    description: 'Хеш расхода',
  })
  expense_hash!: string;

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

  @Field(() => Number, {
    nullable: true,
    description: 'ID фонда',
  })
  fund_id?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Статус из блокчейна',
  })
  blockchain_status?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Сумма расхода',
  })
  amount?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Описание расхода',
  })
  description?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Дата расхода',
  })
  spended_at?: string;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Служебная записка о расходе',
  })
  expense_statement!: DocumentAggregateDTO | null;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Одобренная записка',
  })
  approved_statement!: DocumentAggregateDTO | null;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Авторизация расхода',
  })
  authorization!: DocumentAggregateDTO | null;
}
