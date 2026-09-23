// add-payment-method-input.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  ValidateNested,
  IsOptional,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';
import { BankAccountInputDTO } from './bank-account-input.dto';
import { SBPDataInputDTO } from './sbp-account.input.dto';
import { t } from '~/i18n';

function IsOnlyOnePaymentMethod(validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'isOnlyOnePaymentMethod',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: any) {
          const obj = args.object as AddPaymentMethodInputDTO;
          const hasBankTransfer = obj.bank_transfer_data !== undefined && obj.bank_transfer_data !== null;
          const hasSbp = obj.sbp_data !== undefined && obj.sbp_data !== null;

          // Ровно один метод должен быть указан
          return (hasBankTransfer && !hasSbp) || (!hasBankTransfer && hasSbp);
        },
        defaultMessage() {
          return t('paymentMethod.addPaymentMethodInput.exactlyOneMethodRequired');
        },
      },
    });
  };
}

@InputType('AddPaymentMethodInput')
export class AddPaymentMethodInputDTO {
  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsNotEmpty({ message: t('paymentMethod.addPaymentMethodInput.usernameRequired') })
  @IsString()
  username!: string;

  @Field(() => Boolean, {
    description: 'Флаг основного метода платежа, который отображается в документах',
    defaultValue: false,
  })
  @IsBoolean()
  is_default!: boolean;

  @Field(() => BankAccountInputDTO, {
    nullable: true,
    description: 'Данные для банковского перевода',
  })
  @IsOptional()
  @ValidateNested()
  bank_transfer_data?: BankAccountInputDTO;

  @Field(() => SBPDataInputDTO, {
    nullable: true,
    description: 'Данные для оплаты через СБП',
  })
  @IsOptional()
  @ValidateNested()
  sbp_data?: SBPDataInputDTO;

  @IsOnlyOnePaymentMethod()
  payment_method!: string; // Это поле используется только для валидации
}
