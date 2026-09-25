import { Type } from 'class-transformer';
// payment-method.dto.ts
import { IsNotEmpty, IsString, IsDefined, IsBoolean, ValidateNested } from 'class-validator';
import { validationMessage } from '@coopenomics/extension-kit';
import { BankAccountInputDTO } from './bank-account-input.dto';
import { Field, InputType } from '@nestjs/graphql';

@InputType('UpdateBankAccountInput')
export class UpdateBankAccountInputDTO {
  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsNotEmpty({ message: validationMessage('paymentMethod.updateBankAccountInput.usernameRequired') })
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Идентификатор платежного метода' })
  @IsNotEmpty({ message: validationMessage('paymentMethod.updateBankAccountInput.idRequired') })
  @IsString()
  method_id!: string;

  @Field(() => Boolean, {
    description: 'Флаг основного метода платежа, который отображается в документах',
  })
  @IsNotEmpty({ message: validationMessage('paymentMethod.updateBankAccountInput.isMainFlagRequired') })
  @IsBoolean()
  is_default!: boolean;

  @Field(() => BankAccountInputDTO, { description: 'Данные банковского счёта' })
  @IsDefined({ message: validationMessage('paymentMethod.updateBankAccountInput.detailsRequired') })
  // Без @Type вложенный объект остаётся простым, и проверки его полей
  // (включая запрет разметки) не запускаются.
  @ValidateNested()
  @Type(() => BankAccountInputDTO)
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
