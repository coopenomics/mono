import { InputType, Field } from '@nestjs/graphql';
import { ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { BankAccountInputDTO } from '~/application/payment-method/dto/bank-account-input.dto';
import { OrganizationType } from '../enum/organization-type.enum';
import { OrganizationDetailsInputDTO } from './organization-details-input.dto';
import { RepresentedByInputDTO } from './represented-by-input.dto';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';
import { t } from '~/i18n';

@InputType('CreateOrganizationDataInput')
export class CreateOrganizationDataInputDTO {
  @Field(() => BankAccountInputDTO, { description: 'Банковский счет организации' })
  @ValidateNested()
  @Type(() => BankAccountInputDTO)
  @IsNotEmpty({ message: t('account.createOrganizationDataInput.fieldBankAccountRequired') })
  bank_account!: BankAccountInputDTO;

  @Field({ description: 'Город' })
  @IsNotEmpty({ message: t('account.createOrganizationDataInput.fieldCityRequired') })
  @NoMarkup()
  city!: string;

  @Field({ description: 'Страна' })
  @IsNotEmpty({ message: t('account.createOrganizationDataInput.fieldCountryRequired') })
  @NoMarkup()
  country!: string;

  @Field(() => OrganizationDetailsInputDTO, { description: 'Детали организации' })
  @ValidateNested()
  @Type(() => OrganizationDetailsInputDTO)
  @IsNotEmpty({ message: t('account.createOrganizationDataInput.fieldDetailsRequired') })
  details!: OrganizationDetailsInputDTO;

  //поле не принимаем - устанавливаем автоматически
  @NoMarkup()
  email!: string;

  @Field({ description: 'Фактический адрес' })
  @IsNotEmpty({ message: t('account.createOrganizationDataInput.fieldFactAddressRequired') })
  @NoMarkup()
  fact_address!: string;

  @Field({ description: 'Полный адрес' })
  @IsNotEmpty({ message: t('account.createOrganizationDataInput.fieldFullAddressRequired') })
  @NoMarkup()
  full_address!: string;

  @Field({ description: 'Полное наименование организации' })
  @IsNotEmpty({ message: t('account.createOrganizationDataInput.fieldFullNameRequired') })
  @NoMarkup()
  full_name!: string;

  @Field({ description: 'Телефон' })
  @IsNotEmpty({ message: t('account.createOrganizationDataInput.fieldPhoneRequired') })
  @NoMarkup()
  phone!: string;

  @Field(() => RepresentedByInputDTO, { description: 'Представитель организации' })
  @ValidateNested()
  @Type(() => RepresentedByInputDTO)
  @IsNotEmpty({ message: t('account.createOrganizationDataInput.fieldRepresentedByRequired') })
  represented_by!: RepresentedByInputDTO;

  @Field({ description: 'Краткое наименование организации' })
  @IsNotEmpty({ message: t('account.createOrganizationDataInput.fieldShortNameRequired') })
  @NoMarkup()
  short_name!: string;

  @Field(() => OrganizationType, { description: 'Тип организации' })
  @IsNotEmpty({ message: t('account.createOrganizationDataInput.fieldTypeRequired') })
  type!: OrganizationType;
}

@InputType('CreateInitOrganizationDataInput')
export class CreateInitOrganizationDataInputDTO extends CreateOrganizationDataInputDTO {
  @Field({ description: 'Email организации' })
  @IsNotEmpty({ message: t('account.createOrganizationDataInput.fieldEmailRequired') })
  @NoMarkup()
  email!: string;
}
