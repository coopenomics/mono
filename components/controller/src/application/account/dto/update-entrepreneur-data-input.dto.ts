import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { Country } from '../enum/country.enum';
import { EntrepreneurDetailsInputDTO } from './entrepreneur-details-input.dto';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';

@InputType('UpdateEntrepreneurDataInput')
export class UpdateEntrepreneurDataInputDTO {
  @Field({ description: 'Имя пользователя' })
  @IsNotEmpty({ message: validationMessage('account.updateEntrepreneurDataInput.fieldUsernameRequired') })
  @NoMarkup()
  username!: string;

  @Field({ description: 'Дата рождения' })
  @IsNotEmpty({ message: validationMessage('account.updateEntrepreneurDataInput.fieldBirthdateRequired') })
  @NoMarkup()
  birthdate!: string;

  @Field({ description: 'Город' })
  @IsNotEmpty({ message: validationMessage('account.updateEntrepreneurDataInput.fieldCityRequired') })
  @NoMarkup()
  city!: string;

  @Field(() => Country, { description: 'Страна' })
  @IsNotEmpty({ message: validationMessage('account.updateEntrepreneurDataInput.fieldCountryRequired') })
  country!: Country;

  @Field(() => EntrepreneurDetailsInputDTO, { description: 'Детали индивидуального предпринимателя' })
  @IsNotEmpty({ message: validationMessage('account.updateEntrepreneurDataInput.fieldDetailsRequired') })
  @ValidateNested()
  @Type(() => EntrepreneurDetailsInputDTO)
  details!: EntrepreneurDetailsInputDTO;

  @Field({ description: 'Электронная почта' })
  @IsNotEmpty({ message: validationMessage('account.updateEntrepreneurDataInput.fieldEmailRequired') })
  @NoMarkup()
  email!: string;

  @Field({ description: 'Имя' })
  @IsNotEmpty({ message: validationMessage('account.updateEntrepreneurDataInput.fieldFirstNameRequired') })
  @NoMarkup()
  first_name!: string;

  @Field({ description: 'Полный адрес' })
  @IsNotEmpty({ message: validationMessage('account.updateEntrepreneurDataInput.fieldFullAddressRequired') })
  @NoMarkup()
  full_address!: string;

  @Field({ description: 'Фамилия' })
  @IsNotEmpty({ message: validationMessage('account.updateEntrepreneurDataInput.fieldLastNameRequired') })
  @NoMarkup()
  last_name!: string;

  @Field({ description: 'Отчество' })
  @IsNotEmpty({ message: validationMessage('account.updateEntrepreneurDataInput.fieldMiddleNameRequired') })
  @NoMarkup()
  middle_name!: string;

  @Field({ description: 'Телефон' })
  @IsNotEmpty({ message: validationMessage('account.updateEntrepreneurDataInput.fieldPhoneRequired') })
  @NoMarkup()
  phone!: string;
}
