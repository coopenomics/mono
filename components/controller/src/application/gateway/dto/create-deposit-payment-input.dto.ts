import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsString, IsNumber } from 'class-validator';

@InputType('CreateDepositPaymentInput')
export class CreateDepositPaymentInputDTO {
  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsString({ message: validationMessage('gateway.createDepositPaymentInput.usernameMustBeString') })
  username!: string;

  @Field(() => Number, { description: 'Сумма взноса' })
  @IsNumber({}, { message: validationMessage('gateway.createDepositPaymentInput.quantityMustBeNumber') })
  quantity!: number;

  @Field(() => String, { description: 'Символ валюты' })
  @IsString({ message: validationMessage('gateway.createDepositPaymentInput.symbolMustBeString') })
  symbol!: string;
}
