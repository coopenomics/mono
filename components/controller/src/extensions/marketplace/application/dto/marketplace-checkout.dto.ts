import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GeneratedDocumentDTO } from '@coopenomics/extension-kit';
import { MarketplaceOrderDTO } from './marketplace-order.dto';
import { MarketplaceCartDTO } from './marketplace-cart.dto';
import { MarketplaceConvertStatementSignedInputDTO } from '../documents-dto/marketplace-convert-statement-document.dto';

@InputType('MarketplaceCheckoutSignedLineInput', {
  description: 'Строка оформления по одной позиции корзины (из превью marketplaceCheckoutSignablePayloads).',
})
export class MarketplaceCheckoutSignedLineInputDTO {
  @Field(() => String, { description: 'Идентификатор предложения позиции корзины.' })
  @IsString()
  public readonly offer_id!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Упаковка позиции (при отпуске упаковкой). Пусто — отпуск по мере.',
  })
  @IsOptional()
  @IsString()
  public readonly package_id?: string | null;

  @Field(() => String, {
    description: 'order_hash будущего заказа из превью.',
  })
  @IsString()
  public readonly order_hash!: string;
}

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

  @Field(() => [MarketplaceCheckoutSignedLineInputDTO], {
    nullable: true,
    description: 'Строки оформления из превью — по одной на каждую позицию корзины (order_hash будущего заказа).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketplaceCheckoutSignedLineInputDTO)
  public readonly lines?: MarketplaceCheckoutSignedLineInputDTO[] | null;

  @Field(() => MarketplaceConvertStatementSignedInputDTO, {
    nullable: true,
    description:
      'Подписанное заказчиком заявление 1110 из превью о переводе недостающей суммы с Цифрового кошелька в программу — ' +
      'только если превью вернуло его (внутреннего членского кошелька не хватает).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MarketplaceConvertStatementSignedInputDTO)
  public readonly signed_convert?: MarketplaceConvertStatementSignedInputDTO | null;
}

@ObjectType('MarketplaceConvertPayload', {
  description:
    'Заявление 1110 к подписи: недостающая сумма перевода в программу (паевая и членская части вместе) и её членская часть. ' +
    'Приходит только когда внутреннего членского кошелька «Стола заказов» не хватает.',
})
export class MarketplaceConvertPayloadDTO {
  @Field(() => String, { description: 'Недостающая сумма перевода, с валютой.' })
  public readonly amount!: string;

  @Field(() => String, { description: 'Членская часть перевода — уходит в членский кошелёк действием convert, с валютой.' })
  public readonly membership_fee!: string;

  @Field(() => GeneratedDocumentDTO, { description: 'Заявление к подписи.' })
  public readonly document!: GeneratedDocumentDTO;

  constructor(init: Partial<MarketplaceConvertPayloadDTO>) {
    Object.assign(this, init);
  }
}

@ObjectType('MarketplaceCheckoutSignableLine', {
  description:
    'Превью строки оформления: идентификатор будущего заказа и суммы по частям — сколько покрывает внутренний членский ' +
    'кошелёк «Стола заказов» (он расходуется первым на взнос и тело) и сколько уйдёт с паевого.',
})
export class MarketplaceCheckoutSignableLineDTO {
  @Field(() => String, { description: 'Идентификатор предложения позиции корзины.' })
  public readonly offer_id!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Упаковка позиции (при отпуске упаковкой); null — отпуск по мере.',
  })
  public readonly package_id!: string | null;

  @Field(() => String, { description: 'order_hash будущего заказа.' })
  public readonly order_hash!: string;

  @Field(() => String, { description: 'Стоимость позиции с членским взносом участка, с валютой.' })
  public readonly amount!: string;

  @Field(() => String, { description: 'Членский взнос кооперативного участка по позиции, с валютой.' })
  public readonly membership_fee!: string;

  @Field(() => String, { description: 'Покрывается внутренним членским кошельком (взнос и часть тела), с валютой.' })
  public readonly from_member!: string;

  @Field(() => String, { description: 'Уходит с паевого (главный паевой, у позиций со склада — свободный паевой программы), с валютой.' })
  public readonly from_share!: string;

  constructor(init: Partial<MarketplaceCheckoutSignableLineDTO>) {
    Object.assign(this, init);
  }
}

@ObjectType('MarketplaceCheckoutPreview', {
  description: 'Превью оформления корзины: строки по позициям и, если внутреннего членского кошелька не хватает, заявление 1110 к подписи.',
})
export class MarketplaceCheckoutPreviewDTO {
  @Field(() => [MarketplaceCheckoutSignableLineDTO])
  public readonly lines!: MarketplaceCheckoutSignableLineDTO[];

  @Field(() => MarketplaceConvertPayloadDTO, { nullable: true, description: 'Заявление о переводе недостающей суммы; null — подпись не нужна.' })
  public readonly convert!: MarketplaceConvertPayloadDTO | null;

  constructor(init: Partial<MarketplaceCheckoutPreviewDTO>) {
    Object.assign(this, init);
  }
}

@ObjectType('MarketplaceCheckoutFailedLine', {
  description: 'Позиция корзины, которую не удалось оформить (осталась в корзине для повтора).',
})
export class MarketplaceCheckoutFailedLineDTO {
  @Field(() => String, { description: 'Идентификатор предложения непрошедшей позиции.' })
  public readonly offer_id!: string;

  @Field(() => String, { nullable: true, description: 'Название товара (для отображения).' })
  public readonly product_name!: string | null;

  @Field(() => Float, { description: 'Количество единиц непрошедшей позиции.' })
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
