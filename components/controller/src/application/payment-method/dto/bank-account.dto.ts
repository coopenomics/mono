import { ObjectType, Field } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import type { BankAccountDomainInterface } from '../../../domain/common/interfaces/bank-account-domain.interface';
import { BankAccountDetailsDTO } from './bank-account-details.dto';
import { IsJSON, IsNotEmpty, IsString } from 'class-validator';

@ObjectType('BankAccount')
export class BankAccountDTO implements BankAccountDomainInterface {
  @Field(() => String, { description: 'Валюта счета' })
  @IsString()
  @IsNotEmpty({ message: validationMessage('paymentMethod.bankAccount.currencyRequired') })
  currency: string;

  @Field(() => String, { nullable: true, description: 'Номер карты' })
  @IsString()
  card_number?: string;

  @Field(() => String, { description: 'Название банка' })
  @IsString()
  @IsNotEmpty({ message: validationMessage('paymentMethod.bankAccount.bankNameRequired') })
  bank_name: string;

  @Field(() => String, { description: 'Номер банковского счета' })
  @IsString()
  @IsNotEmpty({ message: validationMessage('paymentMethod.bankAccount.accountNumberRequired') })
  account_number: string;

  @Field(() => BankAccountDetailsDTO, { description: 'Детали счета' })
  @IsNotEmpty({ message: validationMessage('paymentMethod.bankAccount.detailsRequired') })
  @IsJSON()
  details: BankAccountDetailsDTO;

  constructor(data: BankAccountDomainInterface) {
    this.currency = data.currency;
    this.bank_name = data.bank_name;
    this.account_number = data.account_number;
    this.details = data.details;
    this.card_number = data.card_number;
  }
}
