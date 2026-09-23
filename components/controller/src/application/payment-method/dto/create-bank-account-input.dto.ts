// payment-method.dto.ts
import { IsNotEmpty, IsString, IsBoolean } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';
import { BankAccountInputDTO } from './bank-account-input.dto';
import { t } from '~/i18n';

@InputType('CreateBankAccountInput')
export class CreateBankAccountInputDTO {
  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsNotEmpty({ message: t('paymentMethod.createBankAccountInput.usernameRequired') })
  @IsString()
  username!: string;

  @Field(() => Boolean, {
    description: 'Флаг основного метода платежа, который отображается в документах',
  })
  @IsNotEmpty({ message: t('paymentMethod.createBankAccountInput.isMainFlagRequired') })
  @IsBoolean()
  is_default!: boolean;

  @Field(() => BankAccountInputDTO, { description: 'Данные для банковского перевода' })
  data!: BankAccountInputDTO;
}
