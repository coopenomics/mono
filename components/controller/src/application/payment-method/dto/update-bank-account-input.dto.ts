// payment-method.dto.ts
import { IsNotEmpty, IsString, IsDefined, IsBoolean } from 'class-validator';
import { BankAccountInputDTO } from './bank-account-input.dto';
import { Field, InputType } from '@nestjs/graphql';
import { t } from '~/i18n';

@InputType('UpdateBankAccountInput')
export class UpdateBankAccountInputDTO {
  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsNotEmpty({ message: t('paymentMethod.updateBankAccountInput.usernameRequired') })
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Идентификатор платежного метода' })
  @IsNotEmpty({ message: t('paymentMethod.updateBankAccountInput.idRequired') })
  @IsString()
  method_id!: string;

  @Field(() => Boolean, {
    description: 'Флаг основного метода платежа, который отображается в документах',
  })
  @IsNotEmpty({ message: t('paymentMethod.updateBankAccountInput.isMainFlagRequired') })
  @IsBoolean()
  is_default!: boolean;

  @Field(() => BankAccountInputDTO, { description: 'Данные банковского счёта' })
  @IsDefined({ message: t('paymentMethod.updateBankAccountInput.detailsRequired') })
  data!: BankAccountInputDTO;
}

// export class CreatePaymentMethodDTO {
//   @Field(() => String, { description: 'Тип метода оплаты' })
//   method_type!: 'sbp' | 'bank_transfer';

//   @Field(() => SBPDataDTO || BankAccountDTO, { description: 'Данные метода платежа' })
//   @IsDefined({ message: 'Данные метода обязательны' })
//   @ValidateNested()
//   @Type((options) => {
//     const object = options?.object as CreatePaymentMethodDTO;
//     if (object.method_type === 'sbp') {
//       return SBPDataDTO;
//     } else if (object.method_type === 'bank_transfer') {
//       return BankAccountDTO;
//     }
//     throw new Error('Invalid method_type');
//   })
//   data!: SBPDataDTO | BankAccountDTO;
// }
