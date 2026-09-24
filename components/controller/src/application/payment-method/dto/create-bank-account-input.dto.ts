// payment-method.dto.ts
import { IsNotEmpty, IsString, IsBoolean } from 'class-validator';
import { validationMessage } from '@coopenomics/extension-kit';
import { Field, InputType } from '@nestjs/graphql';
import { BankAccountInputDTO } from './bank-account-input.dto';

@InputType('CreateBankAccountInput')
export class CreateBankAccountInputDTO {
  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsNotEmpty({ message: validationMessage('paymentMethod.createBankAccountInput.usernameRequired') })
  @IsString()
  username!: string;

  @Field(() => Boolean, {
    description: 'Флаг основного метода платежа, который отображается в документах',
  })
  @IsNotEmpty({ message: validationMessage('paymentMethod.createBankAccountInput.isMainFlagRequired') })
  @IsBoolean()
  is_default!: boolean;

  @Field(() => BankAccountInputDTO, { description: 'Данные для банковского перевода' })
  data!: BankAccountInputDTO;
}
