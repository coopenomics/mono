import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';
import { MarketplaceOrderDTO } from './marketplace-order.dto';
import { MarketplaceCartDTO } from './marketplace-cart.dto';

@InputType('MarketplaceCheckoutCartInput', {
  description: 'Оформить заказ из корзины (или повторить упавший остаток того же заказа).',
})
export class MarketplaceCheckoutCartInputDTO {
  @Field(() => String, {
    nullable: true,
    description:
      'Идентификатор заказа для повтора остатка: при частичном сбое прошлого оформления ' +
      'передаётся тот же checkout_id, чтобы непрошедшие позиции легли в тот же заказ. ' +
      'Пусто — оформляется новый заказ.',
  })
  @IsOptional()
  @IsString()
  public readonly checkout_id?: string | null;
}

@ObjectType('MarketplaceCheckoutFailedLine', {
  description: 'Позиция корзины, которую не удалось оформить (осталась в корзине для повтора).',
})
export class MarketplaceCheckoutFailedLineDTO {
  @Field(() => String, { description: 'Идентификатор предложения непрошедшей позиции.' })
  public readonly offer_id!: string;

  @Field(() => String, { nullable: true, description: 'Название товара (для отображения).' })
  public readonly product_name!: string | null;

  @Field(() => Int, { description: 'Количество единиц непрошедшей позиции.' })
  public readonly quantity!: number;

  @Field(() => String, { description: 'Причина, по которой позиция не оформлена.' })
  public readonly reason!: string;

  constructor(init: Partial<MarketplaceCheckoutFailedLineDTO>) {
    Object.assign(this, init);
  }
}

@ObjectType('MarketplaceCheckoutResult', {
  description:
    'Результат оформления заказа из корзины: общий идентификатор заказа, оформленные позиции ' +
    'и непрошедший остаток (если был частичный сбой).',
})
export class MarketplaceCheckoutResultDTO {
  @Field(() => String, { description: 'Идентификатор заказа (общий для всех оформленных позиций).' })
  public readonly checkout_id!: string;

  @Field(() => String, { description: 'Пункт выдачи (КУ) заказа.' })
  public readonly delivery_braname!: string;

  @Field(() => [MarketplaceOrderDTO], { description: 'Успешно оформленные позиции (строки заказа).' })
  public readonly created_orders!: MarketplaceOrderDTO[];

  @Field(() => [MarketplaceCheckoutFailedLineDTO], {
    description: 'Позиции, которые не удалось оформить — остались в корзине для повтора.',
  })
  public readonly failed_lines!: MarketplaceCheckoutFailedLineDTO[];

  @Field(() => Boolean, {
    description: 'true — все позиции оформлены и корзина по этому заказу пуста; false — есть остаток.',
  })
  public readonly fully_completed!: boolean;

  @Field(() => MarketplaceCartDTO, { description: 'Корзина после оформления (с непрошедшим остатком).' })
  public readonly cart!: MarketplaceCartDTO;

  constructor(init: Partial<MarketplaceCheckoutResultDTO>) {
    Object.assign(this, init);
  }
}
