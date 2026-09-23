import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PassportInputDTO } from './passport-input.dto';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';
import { t } from '~/i18n';

@InputType('UpdateIndividualDataInput')
export class UpdateIndividualDataInputDTO {
  @Field({ description: 'Имя пользователя' })
  @IsNotEmpty({ message: t('account.updateIndividualDataInput.fieldUsernameRequired') })
  @NoMarkup()
  username!: string;

  @Field({ description: 'Дата рождения' })
  @IsNotEmpty({ message: t('account.updateIndividualDataInput.fieldBirthdateRequired') })
  @NoMarkup()
  birthdate!: string;

  @Field({ description: 'Электронная почта' })
  @IsNotEmpty({ message: t('account.updateIndividualDataInput.fieldEmailRequired') })
  @NoMarkup()
  email!: string;

  @Field({ description: 'Имя' })
  @IsNotEmpty({ message: t('account.updateIndividualDataInput.fieldFirstNameRequired') })
  @NoMarkup()
  first_name!: string;

  @Field({ description: 'Полный адрес' })
  @IsNotEmpty({ message: t('account.updateIndividualDataInput.fieldFullAddressRequired') })
  @NoMarkup()
  full_address!: string;

  @Field({ description: 'Фамилия' })
  @IsNotEmpty({ message: t('account.updateIndividualDataInput.fieldLastNameRequired') })
  @NoMarkup()
  last_name!: string;

  @Field({ description: 'Отчество' })
  @IsNotEmpty({ message: t('account.updateIndividualDataInput.fieldMiddleNameRequired') })
  @NoMarkup()
  middle_name!: string;

  @Field(() => PassportInputDTO, { nullable: true, description: 'Данные паспорта' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PassportInputDTO)
  passport?: PassportInputDTO;

  @Field({ description: 'Телефон' })
  @IsNotEmpty({ message: t('account.updateIndividualDataInput.fieldPhoneRequired') })
  @NoMarkup()
  phone!: string;
}
