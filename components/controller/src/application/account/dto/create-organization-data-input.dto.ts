import { InputType, Field } from '@nestjs/graphql';
import { ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { BankAccountInputDTO } from '~/application/payment-method/dto/bank-account-input.dto';
import { OrganizationType } from '../enum/organization-type.enum';
import { OrganizationDetailsInputDTO } from './organization-details-input.dto';
import { RepresentedByInputDTO } from './represented-by-input.dto';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';

@InputType('CreateOrganizationDataInput')
export class CreateOrganizationDataInputDTO {
  @Field(() => BankAccountInputDTO, { description: 'Банковский счет организации' })
  @ValidateNested()
  @Type(() => BankAccountInputDTO)
  @IsNotEmpty({ message: 'Поле "bank_account" обязательно для заполнения.' })
  bank_account!: BankAccountInputDTO;

  @Field({ description: 'Город' })
  @IsNotEmpty({ message: 'Поле "city" обязательно для заполнения.' })
  @NoMarkup()
  city!: string;

  @Field({ description: 'Страна' })
  @IsNotEmpty({ message: 'Поле "country" обязательно для заполнения.' })
  @NoMarkup()
  country!: string;

  @Field(() => OrganizationDetailsInputDTO, { description: 'Детали организации' })
  @ValidateNested()
  @Type(() => OrganizationDetailsInputDTO)
  @IsNotEmpty({ message: 'Поле "details" обязательно для заполнения.' })
  details!: OrganizationDetailsInputDTO;

  //поле не принимаем - устанавливаем автоматически
  @NoMarkup()
  email!: string;

  @Field({ description: 'Фактический адрес' })
  @IsNotEmpty({ message: 'Поле "fact_address" обязательно для заполнения.' })
  @NoMarkup()
  fact_address!: string;

  @Field({ description: 'Полный адрес' })
  @IsNotEmpty({ message: 'Поле "full_address" обязательно для заполнения.' })
  @NoMarkup()
  full_address!: string;

  @Field({ description: 'Полное наименование организации' })
  @IsNotEmpty({ message: 'Поле "full_name" обязательно для заполнения.' })
  @NoMarkup()
  full_name!: string;

  @Field({ description: 'Телефон' })
  @IsNotEmpty({ message: 'Поле "phone" обязательно для заполнения.' })
  @NoMarkup()
  phone!: string;

  @Field(() => RepresentedByInputDTO, { description: 'Представитель организации' })
  @ValidateNested()
  @Type(() => RepresentedByInputDTO)
  @IsNotEmpty({ message: 'Поле "represented_by" обязательно для заполнения.' })
  represented_by!: RepresentedByInputDTO;

  @Field({ description: 'Краткое наименование организации' })
  @IsNotEmpty({ message: 'Поле "short_name" обязательно для заполнения.' })
  @NoMarkup()
  short_name!: string;

  @Field(() => OrganizationType, { description: 'Тип организации' })
  @IsNotEmpty({ message: 'Поле "type" обязательно для заполнения.' })
  type!: OrganizationType;
}

@InputType('CreateInitOrganizationDataInput')
export class CreateInitOrganizationDataInputDTO extends CreateOrganizationDataInputDTO {
  @Field({ description: 'Email организации' })
  @IsNotEmpty({ message: 'Поле "email" обязательно для заполнения.' })
  @NoMarkup()
  email!: string;
}
