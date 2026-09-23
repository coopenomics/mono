import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import type { BankAccountDomainInterface } from '../../../domain/common/interfaces/bank-account-domain.interface';
import { BankAccountDetailsInputDTO } from './bank-account-details-input.dto';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';

@InputType('BankAccountInput')
export class BankAccountInputDTO implements BankAccountDomainInterface {
  @Field(() => String, { description: 'Валюта счета' })
  @IsString()
  @IsNotEmpty({ message: validationMessage('paymentMethod.bankAccountInput.currencyRequired') })
  @NoMarkup()
  currency!: string;

  @Field(() => String, { nullable: true, description: 'Номер карты' })
  @IsString()
  @IsOptional()
  @NoMarkup()
  card_number?: string;

  @Field(() => String, { description: 'Название банка' })
  @IsString()
  @IsNotEmpty({ message: validationMessage('paymentMethod.bankAccountInput.bankNameRequired') })
  @NoMarkup()
  bank_name!: string;

  @Field(() => String, { description: 'Номер банковского счета' })
  @IsString()
  @IsNotEmpty({ message: validationMessage('paymentMethod.bankAccountInput.accountNumberRequired') })
  @NoMarkup()
  account_number!: string;

  @Field(() => BankAccountDetailsInputDTO, { description: 'Детали счета' })
  @IsNotEmpty({ message: validationMessage('paymentMethod.bankAccountInput.detailsRequired') })
  @ValidateNested()
  @Type(() => BankAccountDetailsInputDTO)
  details!: BankAccountDetailsInputDTO;
}
