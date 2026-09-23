import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsNumber } from 'class-validator';
import { t } from '~/i18n';

@InputType('CreateDepositPaymentInput')
export class CreateDepositPaymentInputDTO {
  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsString({ message: t('gateway.createDepositPaymentInput.usernameMustBeString') })
  username!: string;

  @Field(() => Number, { description: 'Сумма взноса' })
  @IsNumber({}, { message: t('gateway.createDepositPaymentInput.quantityMustBeNumber') })
  quantity!: number;

  @Field(() => String, { description: 'Символ валюты' })
  @IsString({ message: t('gateway.createDepositPaymentInput.symbolMustBeString') })
  symbol!: string;
}
