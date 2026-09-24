import { InputType, ObjectType, Field } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { RepresentedByDomainInterface } from '~/domain/common/interfaces/represented-by.interface';

@ObjectType()
@InputType()
class RepresentedByBase {
  @Field(() => String, { description: 'Имя' })
  @IsNotEmpty({ message: validationMessage('account.representedByDto.firstNameRequired') })
  @IsString({ message: validationMessage('account.representedByDto.firstNameMustBeString') })
  first_name: string;

  @Field(() => String, { description: 'Фамилия' })
  @IsOptional() // Допускаем отсутствие или пустую строку
  @IsString({ message: validationMessage('account.representedByDto.lastNameMustBeString') })
  last_name: string;

  @Field(() => String, { description: 'Отчество' })
  @IsNotEmpty({ message: validationMessage('account.representedByDto.middleNameRequired') })
  @IsString({ message: validationMessage('account.representedByDto.middleNameMustBeString') })
  middle_name: string;

  @Field(() => String, { description: 'Должность' })
  @IsNotEmpty({ message: validationMessage('account.representedByDto.positionRequired') })
  @IsString({ message: validationMessage('account.representedByDto.positionMustBeString') })
  position: string;

  @Field(() => String, { description: 'На основании чего действует' })
  @IsNotEmpty({ message: validationMessage('account.representedByDto.basedOnRequired') })
  @IsString({ message: validationMessage('account.representedByDto.basedOnMustBeString') })
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
