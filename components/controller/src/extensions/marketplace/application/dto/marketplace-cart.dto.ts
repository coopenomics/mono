import { Field, Float, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { MarketplaceSaleFormEnum, MarketplaceUnitOfMeasureEnum } from './marketplace-offer.dto';

/** Почему позицию корзины нельзя оформить. */
export enum MarketplaceCartItemBlockerEnum {
  /** Предложение больше не доступно заказчику. */
  OFFER_GONE = 'OFFER_GONE',
  /** Поставщик изменил каталог упаковок, и выбранной упаковки в нём больше нет. */
  PACKAGE_GONE = 'PACKAGE_GONE',
  /** Предложение не возят на пункт выдачи, выбранный в корзине. */
  NOT_DELIVERED_TO_POINT = 'NOT_DELIVERED_TO_POINT',
}

registerEnumType(MarketplaceCartItemBlockerEnum, {
  name: 'MarketplaceCartItemBlocker',
  description: 'Причина, по которой позицию корзины нельзя оформить.',
});

/**
 * Эпик 16: позиция корзины с обогащением для UI. Реквизиты товара
 * (название, единица, цена, изображение) подмешиваются на чтении из
 * оффера — на самой позиции хранится только offer_id + количество.
 */
@ObjectType('MarketplaceCartItem', { description: 'Позиция корзины заказчика.' })
export class MarketplaceCartItemDTO {
  @Field(() => String, { description: 'Идентификатор позиции корзины.' })
  public readonly id!: string;

  @Field(() => String, { description: 'Идентификатор предложения.' })
  public readonly offer_id!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Выбранная упаковка (при отпуске упаковкой); null — отпуск по мере.',
  })
  public readonly package_id!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Подпись единицы отпуска для упаковки («упак. 0,5 л»); null — отпуск по мере.',
  })
  public readonly package_label!: string | null;

  @Field(() => MarketplaceSaleFormEnum, {
    nullable: true,
    description: 'Способ отпуска предложения: по мере или упаковкой.',
  })
  public readonly sale_form!: MarketplaceSaleFormEnum | null;

  @Field(() => Float, {
    description: 'Количество: базовое (по мере) или число упаковок (упаковкой).',
  })
  public readonly quantity!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Название товара из предложения — для отображения в корзине.',
  })
  public readonly product_name!: string | null;

  @Field(() => MarketplaceUnitOfMeasureEnum, {
    nullable: true,
    description: 'Базовая единица измерения товара (штука, килограмм, литр).',
  })
  public readonly unit_of_measure!: MarketplaceUnitOfMeasureEnum | null;

  @Field(() => String, {
    nullable: true,
    description: 'Цена за одну единицу заказа на текущий момент.',
  })
  public readonly price_per_unit!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Сумма позиции (цена за единицу × количество).',
  })
  public readonly line_total!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'URL обложки товара (если у предложения есть изображение).',
  })
  public readonly image_url!: string | null;

  @Field(() => Boolean, {
    description:
      'Доступна ли позиция к доставке на текущий пункт выдачи корзины. false — ' +
      'товар не возят на выбранный КУ (нужно убрать перед оформлением или сменить КУ).',
  })
  public readonly available_on_current_ku!: boolean;

  @Field(() => MarketplaceCartItemBlockerEnum, {
    nullable: true,
    description: 'Причина недоступности позиции; null — позицию можно оформить.',
  })
  public readonly blocker!: MarketplaceCartItemBlockerEnum | null;

  @Field(() => Float, {
    nullable: true,
    description:
      'Максимально доступное количество единиц по предложению. null — без ограничения (можно заказать любое количество).',
  })
  public readonly max_available!: number | null;

  constructor(init: Partial<MarketplaceCartItemDTO>) {
    Object.assign(this, init);
  }
}

@ObjectType('MarketplaceCart', { description: 'Корзина заказчика — накопитель позиций перед оформлением.' })
export class MarketplaceCartDTO {
  @Field(() => String, { description: 'Идентификатор корзины.' })
  public readonly id!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Пункт выдачи (ПВЗ), к которому привязана корзина; null — пока не выбран.',
  })
  public readonly delivery_braname!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Наименование пункта выдачи (кооперативного участка) — для шапки/корзины.',
  })
  public readonly delivery_point_name!: string | null;

  @Field(() => [MarketplaceCartItemDTO], { description: 'Позиции корзины.' })
  public readonly items!: MarketplaceCartItemDTO[];

  @Field(() => Int, { description: 'Количество разных позиций (строк) в корзине.' })
  public readonly positions_count!: number;

  @Field(() => Float, { description: 'Суммарное количество единиц всех позиций.' })
  public readonly total_quantity!: number;

  @Field(() => String, { description: 'Итоговая сумма корзины (по доступным к доставке позициям).' })
  public readonly total_cost!: string;

  constructor(init: Partial<MarketplaceCartDTO>) {
    Object.assign(this, init);
  }
}
