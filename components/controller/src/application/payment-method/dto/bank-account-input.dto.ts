import { Field, InputType } from '@nestjs/graphql';
import type { BankAccountDomainInterface } from '../../../domain/common/interfaces/bank-account-domain.interface';
import { BankAccountDetailsInputDTO } from './bank-account-details-input.dto';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';

@InputType('BankAccountInput')
export class BankAccountInputDTO implements BankAccountDomainInterface {
  @Field(() => String, { description: 'Валюта счета' })
  @IsString()
  @IsNotEmpty({ message: 'Указание валюты счета обязательно' })
  @NoMarkup()
  currency!: string;

  @Field(() => String, { nullable: true, description: 'Номер карты' })
  @IsString()
  @IsOptional()
  @NoMarkup()
  card_number?: string;

  @Field(() => String, { description: 'Название банка' })
  @IsString()
  @IsNotEmpty({ message: 'Название банка обязательно' })
  @NoMarkup()
  bank_name!: string;

  @Field(() => String, { description: 'Номер банковского счета' })
  @IsString()
  @IsNotEmpty({ message: 'Номер банковского счёта обязателен' })
  @NoMarkup()
  account_number!: string;

  @Field(() => BankAccountDetailsInputDTO, { description: 'Детали счета' })
  @IsNotEmpty({ message: 'Детали счёта обязательны' })
  @ValidateNested()
  @Type(() => BankAccountDetailsInputDTO)
  details!: BankAccountDetailsInputDTO;
}
