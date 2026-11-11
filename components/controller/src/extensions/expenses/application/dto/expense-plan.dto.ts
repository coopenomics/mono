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

  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'Срок следующего платежа повторяющегося расхода; пусто у разового расхода.',
  })
  next_due_date?: Date | null;

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

@InputType('ExpensePlanScheduleInput')
export class ExpensePlanScheduleInputDTO {
  @Field(() => Float, { description: 'Сумма платежа.' })
  @IsNumber()
  @Min(0)
  amount!: number;

  @Field(() => GraphQLISODateTime, { description: 'Срок первого платежа.' })
  @IsDate()
  @Type(() => Date)
  due_date!: Date;

  @Field(() => ExpensePlanRecurrence, {
    nullable: true,
    defaultValue: ExpensePlanRecurrence.NONE,
    description: 'Периодичность расхода.',
  })
  @IsOptional()
  @IsEnum(ExpensePlanRecurrence)
  recurrence?: ExpensePlanRecurrence;
}

@ObjectType('ExpensePlanSchedule', {
  description:
    'Сроки платежей планового расхода и резерв под них — показ до добавления расхода в реестр.',
})
export class ExpensePlanScheduleDTO {
  @Field(() => [GraphQLISODateTime], {
    description: 'Сроки платежей: первый и следующие по периодичности; у разового расхода — один срок.',
  })
  due_dates!: Date[];

  @Field(() => Int, {
    description: 'Сколько месяцев резерв участка копит один платёж: три у квартального, двенадцать у годового, один у прочих.',
  })
  reserve_months!: number;

  @Field(() => String, {
    description: 'Сколько резерв откладывает под платёж за месяц; последний месяц перед сроком добирает остаток.',
  })
  reserve_per_month!: string;
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
