import { Field, InputType } from '@nestjs/graphql';
import { BankAccountInputDTO } from '~/application/payment-method/dto/bank-account-input.dto';
import { Country } from '../enum/country.enum';
import { EntrepreneurDetailsInputDTO } from './entrepreneur-details-input.dto';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';
import { t } from '~/i18n';

@InputType('CreateEntrepreneurDataInput')
export class CreateEntrepreneurDataInputDTO {
  @Field(() => BankAccountInputDTO, { description: 'Банковский счет' })
  @IsNotEmpty({ message: t('account.createEntrepreneurDataInput.fieldBankAccountRequired') })
  @ValidateNested()
  @Type(() => BankAccountInputDTO)
  bank_account!: BankAccountInputDTO;

  @Field({ description: 'Дата рождения' })
  @IsNotEmpty({ message: t('account.createEntrepreneurDataInput.fieldBirthdateRequired') })
  @NoMarkup()
  birthdate!: string;

  @Field({ description: 'Город' })
  @IsNotEmpty({ message: t('account.createEntrepreneurDataInput.fieldCityRequired') })
  @NoMarkup()
  city!: string;

  @Field(() => Country, { description: 'Страна' })
  @IsNotEmpty({ message: t('account.createEntrepreneurDataInput.fieldCountryRequired') })
  country!: Country;

  @Field(() => EntrepreneurDetailsInputDTO, { description: 'Детали индивидуального предпринимателя' })
  @IsNotEmpty({ message: t('account.createEntrepreneurDataInput.fieldDetailsRequired') })
  @ValidateNested()
  @Type(() => EntrepreneurDetailsInputDTO)
  details!: EntrepreneurDetailsInputDTO;

  //поле не принимаем - устанавливаем автоматически
  @NoMarkup()
  email!: string;

  @Field({ description: 'Имя' })
  @IsNotEmpty({ message: t('account.createEntrepreneurDataInput.fieldFirstNameRequired') })
  @NoMarkup()
  first_name!: string;

  @Field({ description: 'Полный адрес' })
  @IsNotEmpty({ message: t('account.createEntrepreneurDataInput.fieldFullAddressRequired') })
  @NoMarkup()
  full_address!: string;

  @Field({ description: 'Фамилия' })
  @IsNotEmpty({ message: t('account.createEntrepreneurDataInput.fieldLastNameRequired') })
  @NoMarkup()
  last_name!: string;

  @Field({ description: 'Отчество' })
  @IsNotEmpty({ message: t('account.createEntrepreneurDataInput.fieldMiddleNameRequired') })
  @NoMarkup()
  middle_name!: string;

  @Field({ description: 'Телефон' })
  @IsNotEmpty({ message: t('account.createEntrepreneurDataInput.fieldPhoneRequired') })
  @NoMarkup()
  phone!: string;
}
