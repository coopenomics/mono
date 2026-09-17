import { Field, InputType } from '@nestjs/graphql';
import { BankAccountInputDTO } from '~/application/payment-method/dto/bank-account-input.dto';
import { Country } from '../enum/country.enum';
import { EntrepreneurDetailsInputDTO } from './entrepreneur-details-input.dto';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';

@InputType('CreateEntrepreneurDataInput')
export class CreateEntrepreneurDataInputDTO {
  @Field(() => BankAccountInputDTO, { description: 'Банковский счет' })
  @IsNotEmpty({ message: 'Поле "bank_account" обязательно для заполнения.' })
  @ValidateNested()
  @Type(() => BankAccountInputDTO)
  bank_account!: BankAccountInputDTO;

  @Field({ description: 'Дата рождения' })
  @IsNotEmpty({ message: 'Поле "birthdate" обязательно для заполнения.' })
  @NoMarkup()
  birthdate!: string;

  @Field({ description: 'Город' })
  @IsNotEmpty({ message: 'Поле "city" обязательно для заполнения.' })
  @NoMarkup()
  city!: string;

  @Field(() => Country, { description: 'Страна' })
  @IsNotEmpty({ message: 'Поле "country" обязательно для заполнения.' })
  country!: Country;

  @Field(() => EntrepreneurDetailsInputDTO, { description: 'Детали индивидуального предпринимателя' })
  @IsNotEmpty({ message: 'Поле "details" обязательно для заполнения.' })
  @ValidateNested()
  @Type(() => EntrepreneurDetailsInputDTO)
  details!: EntrepreneurDetailsInputDTO;

  //поле не принимаем - устанавливаем автоматически
  @NoMarkup()
  email!: string;

  @Field({ description: 'Имя' })
  @IsNotEmpty({ message: 'Поле "first_name" обязательно для заполнения.' })
  @NoMarkup()
  first_name!: string;

  @Field({ description: 'Полный адрес' })
  @IsNotEmpty({ message: 'Поле "full_address" обязательно для заполнения.' })
  @NoMarkup()
  full_address!: string;

  @Field({ description: 'Фамилия' })
  @IsNotEmpty({ message: 'Поле "last_name" обязательно для заполнения.' })
  @NoMarkup()
  last_name!: string;

  @Field({ description: 'Отчество' })
  @IsNotEmpty({ message: 'Поле "middle_name" обязательно для заполнения.' })
  @NoMarkup()
  middle_name!: string;

  @Field({ description: 'Телефон' })
  @IsNotEmpty({ message: 'Поле "phone" обязательно для заполнения.' })
  @NoMarkup()
  phone!: string;
}
