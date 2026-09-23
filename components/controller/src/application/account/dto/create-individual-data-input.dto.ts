import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PassportInputDTO } from './passport-input.dto';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';
import { t } from '~/i18n';

@InputType('CreateIndividualDataInput')
export class CreateIndividualDataInputDTO {
  @Field({ description: 'Дата рождения' })
  @IsNotEmpty({ message: t('account.createIndividualDataInput.fieldBirthdateRequired') })
  @NoMarkup()
  birthdate!: string;

  //поле не принимаем - устанавливаем автоматически
  @NoMarkup()
  email!: string;

  @Field({ description: 'Имя' })
  @IsNotEmpty({ message: t('account.createIndividualDataInput.fieldFirstNameRequired') })
  @NoMarkup()
  first_name!: string;

  @Field({ description: 'Полный адрес' })
  @IsNotEmpty({ message: t('account.createIndividualDataInput.fieldFullAddressRequired') })
  @NoMarkup()
  full_address!: string;

  @Field({ description: 'Фамилия' })
  @IsNotEmpty({ message: t('account.createIndividualDataInput.fieldLastNameRequired') })
  @NoMarkup()
  last_name!: string;

  @Field({ description: 'Отчество' })
  @IsNotEmpty({ message: t('account.createIndividualDataInput.fieldMiddleNameRequired') })
  @NoMarkup()
  middle_name!: string;

  @Field(() => PassportInputDTO, { nullable: true, description: 'Данные паспорта' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PassportInputDTO)
  passport?: PassportInputDTO;

  @Field({ description: 'Телефон' })
  @IsNotEmpty({ message: t('account.createIndividualDataInput.fieldPhoneRequired') })
  @NoMarkup()
  phone!: string;
}

@InputType('CreateSovietIndividualDataInput')
export class CreateSovietIndividualDataInputDTO extends CreateIndividualDataInputDTO {
  @Field({ description: 'Email адрес' })
  @IsNotEmpty({ message: t('account.createIndividualDataInput.fieldEmailRequired') })
  @NoMarkup()
  email!: string;
}
