import { Field, InputType } from '@nestjs/graphql';
import { IsString, Matches, MaxLength, Length } from 'class-validator';

/**
 * Input мутации `billingPay` (действие `billing::pay`, operation `o.bil.pay`).
 *
 * Списывает с биллинг-кошелька пайщика суммарную стоимость подписок в
 * инфраструктурный кошелёк кооператива. Идемпотентно по `paymentHash`.
 * Состав и цены подписок on-chain не передаются — только сумма + payment_hash.
 */
@InputType('BillingPayInput')
export class BillingPayInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта пайщика — владельца биллинг-кошелька' })
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Сумма с символом, например "1500.0000 RUB"' })
  @IsString()
  @Matches(/^\d+(\.\d+)?\s+[A-Z]{1,7}$/, { message: 'Формат "<amount> <SYMBOL>", например "1500.0000 RUB"' })
  amount!: string;

  @Field(() => String, {
    description: 'Детерминированный идентификатор платежа (payment_hash из getBillingSummary провайдера)',
  })
  @IsString()
  @Length(1, 64)
  paymentHash!: string;

  @Field(() => String, { description: 'Назначение платежа' })
  @IsString()
  @MaxLength(255)
  memo!: string;
}
