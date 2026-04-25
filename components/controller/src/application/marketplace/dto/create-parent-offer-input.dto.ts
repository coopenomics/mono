import { Field, InputType } from '@nestjs/graphql';
import { IsNumber, IsString, Matches } from 'class-validator';
import { ASSET_REGEX } from '~/types/shared';

@InputType('CreateParentOfferInput')
export class CreateParentOfferInputDTO {
  @Field({ description: 'Имя кооператива' })
  @IsString()
  coopname!: string;

  @Field({ description: 'Имя пользователя, инициирующего или обновляющего заявку' })
  @IsString()
  username!: string;

  @Field({ description: 'Идентификатор родительской заявки' })
  @IsNumber()
  parent_id!: number;

  @Field({ description: 'Идентификатор программы' })
  @IsNumber()
  program_id!: number;

  @Field({ description: 'Количество частей (штук) товара или услуги' })
  @IsNumber()
  units!: number;

  @Field({ description: 'Цена за единицу (штуку) товара или услуги в формате "10.0000 RUB"' })
  @Matches(ASSET_REGEX, {
    message: 'Формат должен быть "10.0000 RUB" (число с четырьмя десятичными знаками + символ валюты)',
  })
  unit_cost!: string;

  @Field({ description: 'Время жизни продукта, заявляемое поставщиком (в секундах)' })
  @IsNumber()
  product_lifecycle_secs!: number;

  @Field({ description: 'Дополнительные данные, специфичные для заявки' })
  @IsString()
  data!: string;

  @Field({ description: 'Метаданные о заявке' })
  @IsString()
  meta!: string;
}
