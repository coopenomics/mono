import { Field, Float, InputType } from '@nestjs/graphql';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

@InputType('MarketplaceAddToCartInput', {
  description: 'Добавить позицию в корзину (с привязкой к пункту выдачи).',
})
export class MarketplaceAddToCartInputDTO {
  @Field(() => String, { description: 'Идентификатор предложения.' })
  @IsString()
  public readonly offer_id!: string;

  @Field(() => Float, {
    description:
      'Количество: при отпуске по мере — в базовой единице (дробное для веса/объёма); ' +
      'при отпуске упаковкой — целое число упаковок.',
  })
  @IsNumber()
  @Min(0)
  public readonly quantity!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Выбранная упаковка (при отпуске упаковкой). Не указывается при отпуске по мере.',
  })
  @IsOptional()
  @IsString()
  public readonly package_id?: string | null;

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

  @Field(() => Float, {
    description: 'Новое количество: базовое (по мере) или число упаковок (упаковкой).',
  })
  @IsNumber()
  @Min(0)
  public readonly quantity!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Выбранная упаковка (при отпуске упаковкой).',
  })
  @IsOptional()
  @IsString()
  public readonly package_id?: string | null;
}

@InputType('MarketplaceRemoveFromCartInput', { description: 'Убрать позицию из корзины.' })
export class MarketplaceRemoveFromCartInputDTO {
  @Field(() => String, { description: 'Идентификатор предложения позиции.' })
  @IsString()
  public readonly offer_id!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Упаковка позиции (при отпуске упаковкой) — какую именно строку убрать.',
  })
  @IsOptional()
  @IsString()
  public readonly package_id?: string | null;
}

@InputType('MarketplaceSetCartDeliveryPointInput', {
  description: 'Сменить пункт выдачи (КУ) корзины.',
})
export class MarketplaceSetCartDeliveryPointInputDTO {
  @Field(() => String, { description: 'Имя пункта выдачи (branch.name) нового КУ доставки.' })
  @IsString()
  public readonly delivery_braname!: string;
}
