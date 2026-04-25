import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsNumber, Matches } from 'class-validator';
import { ASSET_REGEX } from '~/types/shared';

@InputType('ModerateRequestInput')
export class ModerateRequestInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsString()
  username!: string;

  @Field(() => Number, { description: 'Идентификатор обмена' })
  @IsNumber()
  exchange_id!: number;

  @Field(() => String, { description: 'Размер комиссии за отмену в формате "10.0000 RUB"' })
  @Matches(ASSET_REGEX, {
    message: 'Формат должен быть "10.0000 RUB" (число с четырьмя десятичными знаками + символ валюты)',
  })
  cancellation_fee!: string;
}
