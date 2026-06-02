import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

@InputType('MarketplaceAddToCartInput', {
  description: 'Добавить позицию в корзину (с привязкой к пункту выдачи).',
})
export class MarketplaceAddToCartInputDTO {
  @Field(() => String, { description: 'Идентификатор предложения.' })
  @IsString()
  public readonly offer_id!: string;

  @Field(() => Int, { description: 'Количество единиц (целое, ≥ 1).' })
  @IsInt()
  @Min(1)
  public readonly quantity!: number;

  @Field(() => String, {
    nullable: true,
    description:
      'Пункт выдачи (ПВЗ) корзины. Если корзина пуста — задаёт её КУ; если непуста — ' +
      'должен совпадать с текущим КУ корзины (один заказ — один КУ).',
  })
  @IsOptional()
  @IsString()
  public readonly delivery_braname?: string | null;
}

@InputType('MarketplaceUpdateCartItemInput', {
  description: 'Изменить количество позиции в корзине.',
})
export class MarketplaceUpdateCartItemInputDTO {
  @Field(() => String, { description: 'Идентификатор предложения позиции.' })
  @IsString()
  public readonly offer_id!: string;

  @Field(() => Int, { description: 'Новое количество единиц (целое, ≥ 1).' })
  @IsInt()
  @Min(1)
  public readonly quantity!: number;
}

@InputType('MarketplaceRemoveFromCartInput', { description: 'Убрать позицию из корзины.' })
export class MarketplaceRemoveFromCartInputDTO {
  @Field(() => String, { description: 'Идентификатор предложения позиции.' })
  @IsString()
  public readonly offer_id!: string;
}

@InputType('MarketplaceSetCartDeliveryPointInput', {
  description: 'Сменить пункт выдачи (КУ) корзины.',
})
export class MarketplaceSetCartDeliveryPointInputDTO {
  @Field(() => String, { description: 'Имя пункта выдачи (branch.name) нового КУ доставки.' })
  @IsString()
  public readonly delivery_braname!: string;
}
