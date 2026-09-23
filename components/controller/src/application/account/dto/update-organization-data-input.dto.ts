import { InputType, Field } from '@nestjs/graphql';
import { ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { OrganizationDetailsInputDTO } from './organization-details-input.dto';
import { RepresentedByInputDTO } from './represented-by-input.dto';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';
import { t } from '~/i18n';

@InputType('UpdateOrganizationDataInput')
export class UpdateOrganizationDataInputDTO {
  @Field({ description: 'Имя пользователя' })
  @IsNotEmpty({ message: t('account.updateOrganizationDataInput.fieldUsernameRequired') })
  @NoMarkup()
  username!: string;

  @Field({ description: 'Город' })
  @IsNotEmpty({ message: t('account.updateOrganizationDataInput.fieldCityRequired') })
  @NoMarkup()
  city!: string;

  @Field({ description: 'Страна' })
  @IsNotEmpty({ message: t('account.updateOrganizationDataInput.fieldCountryRequired') })
  @NoMarkup()
  country!: string;

  @Field(() => OrganizationDetailsInputDTO, { description: 'Детали организации' })
  @ValidateNested()
  @Type(() => OrganizationDetailsInputDTO)
  @IsNotEmpty({ message: t('account.updateOrganizationDataInput.fieldDetailsRequired') })
  details!: OrganizationDetailsInputDTO;

  @Field({ description: 'Электронная почта' })
  @IsNotEmpty({ message: t('account.updateOrganizationDataInput.fieldEmailRequired') })
  @NoMarkup()
  email!: string;

  @Field({ description: 'Фактический адрес' })
  @IsNotEmpty({ message: t('account.updateOrganizationDataInput.fieldFactAddressRequired') })
  @NoMarkup()
  fact_address!: string;

  @Field({ description: 'Полный адрес' })
  @IsNotEmpty({ message: t('account.updateOrganizationDataInput.fieldFullAddressRequired') })
  @NoMarkup()
  full_address!: string;

  @Field({ description: 'Полное наименование организации' })
  @IsNotEmpty({ message: t('account.updateOrganizationDataInput.fieldFullNameRequired') })
  @NoMarkup()
  full_name!: string;

  @Field({ description: 'Телефон' })
  @IsNotEmpty({ message: t('account.updateOrganizationDataInput.fieldPhoneRequired') })
  @NoMarkup()
  phone!: string;

  @Field(() => RepresentedByInputDTO, { description: 'Представитель организации' })
  @ValidateNested()
  @Type(() => RepresentedByInputDTO)
  @IsNotEmpty({ message: t('account.updateOrganizationDataInput.fieldRepresentedByRequired') })
  represented_by!: RepresentedByInputDTO;

  @Field({ description: 'Краткое наименование организации' })
  @IsNotEmpty({ message: t('account.updateOrganizationDataInput.fieldShortNameRequired') })
  @NoMarkup()
  short_name!: string;

  @Field(() => String, { description: 'Тип организации' })
  @IsNotEmpty({ message: t('account.updateOrganizationDataInput.fieldTypeRequired') })
  @NoMarkup()
  type!: string;
}
