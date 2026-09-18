import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PassportInputDTO } from './passport-input.dto';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';

@InputType('UpdateIndividualDataInput')
export class UpdateIndividualDataInputDTO {
  @Field({ description: 'Имя пользователя' })
  @IsNotEmpty({ message: 'Поле "username" обязательно для заполнения.' })
  @NoMarkup()
  username!: string;

  @Field({ description: 'Дата рождения' })
  @IsNotEmpty({ message: 'Поле "birthdate" обязательно для заполнения.' })
  @NoMarkup()
  birthdate!: string;

  @Field({ description: 'Электронная почта' })
  @IsNotEmpty({ message: 'Поле "email" обязательно для заполнения.' })
  @NoMarkup()
  email!: string;

  @Field({ description: 'Имя' })
  @IsNotEmpty({ message: 'Поле "first_name" обязательно для заполнения.' })
  @NoMarkup()
  first_name!: string;

  @Field({ description: 'Полный адрес' })
  @IsNotEmpty({ message: 'Поле "full_address" обязательно для заполнения.' })
  @NoMarkup()
  full_address!: string;

  @Field({ description: 'Фамилия' })
  @IsNotEmpty({ message: 'Поле "last_name" обязательно для заполнения.' })
  @NoMarkup()
  last_name!: string;

  @Field({ description: 'Отчество' })
  @IsNotEmpty({ message: 'Поле "middle_name" обязательно для заполнения.' })
  @NoMarkup()
  middle_name!: string;

  @Field(() => PassportInputDTO, { nullable: true, description: 'Данные паспорта' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PassportInputDTO)
  passport?: PassportInputDTO;

  @Field({ description: 'Телефон' })
  @IsNotEmpty({ message: 'Поле "phone" обязательно для заполнения.' })
  @NoMarkup()
  phone!: string;
}
