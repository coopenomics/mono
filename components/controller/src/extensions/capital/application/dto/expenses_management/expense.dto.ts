import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { ExpenseStatus } from '../../../domain/enums/expense-status.enum';
import { BaseOutputDTO } from '@coopenomics/extension-kit/sync';
import { AuthRoles, DocumentAggregateDTO } from '@coopenomics/extension-kit';

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

  // Текст документа несёт личные данные и в цепь не пишется — его видят
  // совет и владелец записи; суммы остаются открытыми, они есть в блокчейне.
  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Служебная записка о расходе',
  })
  @AuthRoles(['chairman', 'member'], { self: ['username'] })
  expense_statement!: DocumentAggregateDTO | null;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Одобренная записка',
  })
  @AuthRoles(['chairman', 'member'], { self: ['username'] })
  approved_statement!: DocumentAggregateDTO | null;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Авторизация расхода',
  })
  @AuthRoles(['chairman', 'member'], { self: ['username'] })
  authorization!: DocumentAggregateDTO | null;
}
