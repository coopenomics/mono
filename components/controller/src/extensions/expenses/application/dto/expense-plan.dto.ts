import { Field, Float, GraphQLISODateTime, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ExpensePlanRecurrence } from '../../domain/expense-plan.types';
import type { ExpensePlanView } from '../services/expense-plans.service';

@ObjectType('ExpensePlan', {
  description:
    'Плановый расход кооператива: что, когда, на какую сумму и по каким реквизитам предстоит оплатить. Привязан к кооперативному участку либо к кооперативу в целом.',
})
export class ExpensePlanDTO {
  @Field(() => Int, { description: 'Идентификатор записи.' })
  id!: number;

  @Field(() => String, { nullable: true, description: 'Кооперативный участок; пусто — расход уровня кооператива.' })
  braname?: string | null;

  @Field({ description: 'Назначение расхода.' })
  title!: string;

  @Field({ description: 'Сумма расхода.' })
  amount!: string;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'Дата, к которой расход должен быть оплачен.',
  })
  due_date?: Date | null;

  @Field(() => ExpensePlanRecurrence, {
    description:
      'Периодичность: разовый расход либо повторяющийся — следующий экземпляр добавляется автоматически по наступлении срока.',
  })
  recurrence!: ExpensePlanRecurrence;

  @Field({ description: 'Реквизиты получателя платежа.' })
  pay_to!: string;

  @Field({ description: 'Кто добавил запись.' })
  creator!: string;

  @Field(() => GraphQLISODateTime, { description: 'Когда добавлена запись.' })
  created_at!: Date;

  @Field(() => String, {
    nullable: true,
    description: 'Расход, которым оплачивается запись; пусто — оплата ещё не запускалась.',
  })
  proposal_hash?: string | null;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'Когда расход фактически оплачен; оплаченные записи не удерживают резерв.',
  })
  paid_at?: Date | null;
}

@InputType('ListExpensePlansInput')
export class ListExpensePlansInputDTO {
  @Field({ nullable: true, description: 'Показать планы только этого кооперативного участка.' })
  @IsOptional()
  @IsString()
  braname?: string;
}

@InputType('CreateExpensePlanInput')
export class CreateExpensePlanInputDTO {
  @Field({ nullable: true, description: 'Кооперативный участок; пусто — расход уровня кооператива.' })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field({ description: 'Назначение расхода.' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @Field(() => Float, { description: 'Сумма расхода.' })
  @IsNumber()
  @Min(0.0001)
  amount!: number;

  @Field(() => GraphQLISODateTime, {
    description: 'Дата, к которой расход должен быть оплачен.',
  })
  @IsDate()
  @Type(() => Date)
  due_date!: Date;

  @Field(() => ExpensePlanRecurrence, {
    nullable: true,
    defaultValue: ExpensePlanRecurrence.NONE,
    description:
      'Периодичность: разовый расход либо повторяющийся — следующий экземпляр добавляется автоматически по наступлении срока.',
  })
  @IsOptional()
  @IsEnum(ExpensePlanRecurrence)
  recurrence?: ExpensePlanRecurrence;

  @Field({ description: 'Реквизиты получателя платежа (передаются в платёжку кассиру).' })
  @IsString()
  @IsNotEmpty()
  pay_to!: string;
}

@InputType('DeleteExpensePlanInput')
export class DeleteExpensePlanInputDTO {
  @Field(() => Int, { description: 'Идентификатор плановой записи.' })
  @IsInt()
  @Min(1)
  plan_id!: number;
}

export function toExpensePlanDTO(plan: ExpensePlanView): ExpensePlanDTO {
  return { ...plan };
}
