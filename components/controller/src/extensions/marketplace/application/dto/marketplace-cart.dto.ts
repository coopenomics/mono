import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

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

  @Field(() => Float, { description: 'Количество единиц в корзине.' })
  public readonly quantity!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Название товара из предложения — для отображения в корзине.',
  })
  public readonly product_name!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Базовая единица измерения товара (штука, килограмм, литр).',
  })
  public readonly unit_of_measure!: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      'Размер единицы заказа (фасовки) в базовых единицах: сколько базовых единиц ' +
      'входит в одну единицу заказа. «0.1» — по 100 г, «8» — упаковка из 8 штук.',
  })
  public readonly order_unit_size!: string | null;

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
