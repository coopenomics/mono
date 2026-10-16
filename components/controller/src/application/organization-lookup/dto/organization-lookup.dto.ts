import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, Matches } from 'class-validator';
import { validationMessage } from '@coopenomics/extension-kit';
import { OrganizationType } from '~/application/account/enum/organization-type.enum';

@InputType('LookupOrganizationInput')
export class LookupOrganizationInputDTO {
  @Field(() => String, { description: 'Страна регистрации организации' })
  @IsNotEmpty({ message: validationMessage('registration.organizationLookup.countryRequired') })
  country!: string;

  @Field(() => String, { description: 'ИНН организации' })
  @Matches(/^(\d{10}|\d{12})$/, { message: validationMessage('registration.organizationLookup.innFormat') })
  inn!: string;
}

@ObjectType('OrganizationLookupRepresentative', { description: 'Руководитель организации по сведениям реестра' })
export class OrganizationLookupRepresentativeDTO {
  @Field(() => String, { nullable: true, description: 'Фамилия' })
  last_name?: string;

  @Field(() => String, { nullable: true, description: 'Имя' })
  first_name?: string;

  @Field(() => String, { nullable: true, description: 'Отчество' })
  middle_name?: string;

  @Field(() => String, { nullable: true, description: 'Должность' })
  position?: string;
}

@ObjectType('OrganizationLookupDetails', { description: 'Регистрационные номера организации' })
export class OrganizationLookupDetailsDTO {
  @Field(() => String, { description: 'ИНН' })
  inn!: string;

  @Field(() => String, { nullable: true, description: 'ОГРН' })
  ogrn?: string;

  @Field(() => String, { nullable: true, description: 'КПП' })
  kpp?: string;
}

@ObjectType('OrganizationLookupResult', {
  description: 'Сведения об организации из государственного реестра. Пустое поле реестр не знает — его заполняет пайщик',
})
export class OrganizationLookupResultDTO {
  @Field(() => String, { nullable: true, description: 'Краткое наименование' })
  short_name?: string;

  @Field(() => String, { nullable: true, description: 'Полное наименование' })
  full_name?: string;

  @Field(() => OrganizationType, { nullable: true, description: 'Тип организации' })
  type?: OrganizationType;

  @Field(() => OrganizationLookupRepresentativeDTO, { nullable: true, description: 'Руководитель' })
  represented_by?: OrganizationLookupRepresentativeDTO;

  @Field(() => String, { nullable: true, description: 'Город' })
  city?: string;

  @Field(() => String, { nullable: true, description: 'Юридический адрес' })
  full_address?: string;

  @Field(() => OrganizationLookupDetailsDTO, { description: 'Регистрационные номера' })
  details!: OrganizationLookupDetailsDTO;
}
