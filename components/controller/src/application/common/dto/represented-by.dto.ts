import { InputType, ObjectType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { RepresentedByDomainInterface } from '~/domain/common/interfaces/represented-by.interface';
import { t } from '~/i18n';

@ObjectType()
@InputType()
class RepresentedByBase {
  @Field(() => String, { description: 'Имя' })
  @IsNotEmpty({ message: t('account.representedByDto.firstNameRequired') })
  @IsString({ message: t('account.representedByDto.firstNameMustBeString') })
  first_name: string;

  @Field(() => String, { description: 'Фамилия' })
  @IsOptional() // Допускаем отсутствие или пустую строку
  @IsString({ message: t('account.representedByDto.lastNameMustBeString') })
  last_name: string;

  @Field(() => String, { description: 'Отчество' })
  @IsNotEmpty({ message: t('account.representedByDto.middleNameRequired') })
  @IsString({ message: t('account.representedByDto.middleNameMustBeString') })
  middle_name: string;

  @Field(() => String, { description: 'Должность' })
  @IsNotEmpty({ message: t('account.representedByDto.positionRequired') })
  @IsString({ message: t('account.representedByDto.positionMustBeString') })
  position: string;

  @Field(() => String, { description: 'На основании чего действует' })
  @IsNotEmpty({ message: t('account.representedByDto.basedOnRequired') })
  @IsString({ message: t('account.representedByDto.basedOnMustBeString') })
  based_on: string;

  constructor(data?: RepresentedByDomainInterface) {
    this.first_name = data?.first_name ?? '';
    this.last_name = data?.last_name ?? '';
    this.middle_name = data?.middle_name ?? '';
    this.position = data?.position ?? '';
    this.based_on = data?.based_on ?? '';
  }
}

@ObjectType('RepresentedBy')
export class RepresentedByDTO extends RepresentedByBase {}

@InputType('RepresentedByInput')
export class RepresentedByGraphQLInput extends RepresentedByBase {}
