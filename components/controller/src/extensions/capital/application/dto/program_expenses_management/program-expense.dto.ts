import { ObjectType, Field, Int } from '@nestjs/graphql';
import { ProgramExpenseStatus } from '../../../domain/enums/program-expense-status.enum';
import { DocumentAggregateDTO } from '~/application/document/dto/document-aggregate.dto';
import { BaseOutputDTO } from '~/shared/dto/base.dto';

@ObjectType('CapitalProgramExpense', {
  description: 'Программный расход «Благорост» (таблица capital::progexpenses)',
})
export class ProgramExpenseOutputDTO extends BaseOutputDTO {
  @Field(() => Int, { nullable: true, description: 'ID в блокчейне' })
  id?: number;

  @Field(() => Int, { nullable: true, description: 'Номер блока последнего обновления' })
  block_num?: number;

  @Field(() => Boolean, {
    description: 'Существует ли запись в блокчейне',
    defaultValue: false,
  })
  present!: boolean;

  @Field(() => ProgramExpenseStatus, { description: 'Статус расхода программы' })
  status!: ProgramExpenseStatus;

  @Field(() => String, { description: 'Хеш расхода (анкер процесса p.cap.expns)' })
  expense_hash!: string;

  @Field(() => String, { nullable: true, description: 'Название кооператива' })
  coopname?: string;

  @Field(() => String, { nullable: true, description: 'Инициатор расхода' })
  username?: string;

  @Field(() => String, { nullable: true, description: 'ID фонда списания' })
  fund_id?: string;

  @Field(() => String, { nullable: true, description: 'Статус из блокчейна' })
  blockchain_status?: string;

  @Field(() => String, { nullable: true, description: 'Сумма расхода (asset)' })
  amount?: string;

  @Field(() => String, { nullable: true, description: 'Описание расхода' })
  description?: string;

  @Field(() => String, { nullable: true, description: 'Дата расхода' })
  spended_at?: string;

  @Field(() => DocumentAggregateDTO, { nullable: true, description: 'Служебная записка по расходу (1010)' })
  expense_statement!: DocumentAggregateDTO | null;

  @Field(() => DocumentAggregateDTO, { nullable: true, description: 'Записка, одобренная председателем' })
  approved_statement!: DocumentAggregateDTO | null;

  @Field(() => DocumentAggregateDTO, { nullable: true, description: 'Решение совета по расходу (1011)' })
  authorization!: DocumentAggregateDTO | null;
}
