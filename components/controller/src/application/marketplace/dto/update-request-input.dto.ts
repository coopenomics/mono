import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsNumberString, Matches, IsNumber } from 'class-validator';
import { ASSET_REGEX } from '~/types/shared';

@InputType('UpdateRequestInput')
export class UpdateRequestInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsString()
  username!: string;

  @Field(() => Number, { description: 'Идентификатор обмена' })
  @IsNumber()
  exchange_id!: number;

  @Field(() => String, { description: 'Оставшееся количество единиц' })
  @IsNumber()
  remain_units!: number;

  @Field(() => String, { description: 'Стоимость за единицу в формате "10.0000 RUB"' })
  @IsString()
  @Matches(ASSET_REGEX, {
    message: 'Формат должен быть "10.0000 RUB" (число с четырьмя десятичными знаками + символ валюты)',
  })
  unit_cost!: string;

  @Field(() => String, { description: 'Дополнительные данные' })
  @IsString()
  data!: string;

  @Field(() => String, { description: 'Дополнительная информация' })
  @IsString()
  meta!: string;
}
