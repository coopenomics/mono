import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsNumber, IsPositive } from 'class-validator';
import { PaymentStatus } from '@coopenomics/innercoop';

/**
 * Удержанный налог к перечислению — то, что стол бухгалтера показывает и
 * отправляет кассиру.
 *
 * Суммы приходят строкой-ассетом («1300.0000 RUB»), как их отдаёт цепь:
 * форматированием занимается интерфейс, а округлять налог по дороге нельзя.
 */

@ObjectType('WithheldTaxState', {
  description: 'Удержанный налог: сколько должны бюджету и что уже у кассира',
})
export class WithheldTaxStateDTO {
  @Field(() => String, { description: 'Удержано и ещё не перечислено' })
  public readonly withheld!: string;

  @Field(() => String, { description: 'Отправлено на оплату и ждёт подтверждения кассиром' })
  public readonly in_payment!: string;

  @Field(() => String, { description: 'Доступно к отправке на оплату' })
  public readonly available!: string;
}

@ObjectType('WithheldTaxRequisiteRow', {
  description: 'Строка реквизитов бюджета: название реквизита и его значение',
})
export class WithheldTaxRequisiteRowDTO {
  @Field(() => String, { description: 'Название реквизита' })
  public readonly label!: string;

  @Field(() => String, { description: 'Значение реквизита' })
  public readonly value!: string;
}

@ObjectType('WithheldTaxPayment', {
  description: 'Отправленный на оплату налог — одна заявка бухгалтера кассиру',
})
export class WithheldTaxPaymentDTO {
  @Field(() => String, { description: 'Хэш заявки: по нему платёж находится в реестре кассира' })
  public readonly hash!: string;

  @Field(() => String, { description: 'Сумма платежа' })
  public readonly amount!: string;

  @Field(() => String, { description: 'Символ валюты' })
  public readonly symbol!: string;

  @Field(() => String, { description: 'Назначение платежа' })
  public readonly memo!: string;

  @Field(() => PaymentStatus, { description: 'Состояние платежа в реестре кассира' })
  public readonly status!: PaymentStatus;

  @Field(() => String, { nullable: true, description: 'Причина отказа, если кассир не заплатил' })
  public readonly message?: string;

  @Field(() => String, { nullable: true, description: 'Получатель платежа' })
  public readonly recipient_name?: string;

  @Field(() => [WithheldTaxRequisiteRowDTO], {
    nullable: true,
    description: 'Реквизиты получателя на день отправки платежа',
  })
  public readonly requisite_rows?: WithheldTaxRequisiteRowDTO[];

  @Field(() => Date, { description: 'Когда платёж отправлен кассиру' })
  public readonly created_at!: Date;

  @Field(() => Date, { nullable: true, description: 'Когда кассир подтвердил перевод' })
  public readonly completed_at?: Date;

  @Field(() => Int, { description: 'Год расчётного периода, в который входит платёж' })
  public readonly report_year!: number;

  @Field(() => Int, {
    description: 'Номер расчётного периода в году: на каждый месяц приходится два',
  })
  public readonly report_period!: number;

  @Field(() => String, {
    description: 'Название расчётного периода, например «Август · 1–22»',
  })
  public readonly report_period_label!: string;
}

@ObjectType('WithheldTaxPaymentPage', {
  description: 'Страница истории перечислений удержанного налога',
})
export class WithheldTaxPaymentPageDTO {
  @Field(() => [WithheldTaxPaymentDTO], { description: 'Платежи страницы' })
  public readonly items!: WithheldTaxPaymentDTO[];

  @Field(() => Int, { description: 'Всего платежей' })
  public readonly totalCount!: number;

  @Field(() => Int, { description: 'Всего страниц' })
  public readonly totalPages!: number;

  @Field(() => Int, { description: 'Текущая страница' })
  public readonly currentPage!: number;
}

@InputType('PayWithheldTaxInput', {
  description: 'Отправка удержанного налога на оплату кассиру',
})
export class PayWithheldTaxInputDTO {
  @Field(() => Float, { description: 'Сумма платежа' })
  @IsNumber()
  @IsPositive({ message: 'Сумма платежа должна быть больше нуля' })
  public readonly amount!: number;
}
