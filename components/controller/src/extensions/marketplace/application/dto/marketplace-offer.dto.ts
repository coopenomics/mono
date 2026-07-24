import { Field, Float, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { createPaginationResult } from '~/application/common/dto/pagination.dto';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import {
  MarketplaceOfferStatuses,
  MarketplaceUnitsOfMeasure,
  type MarketplaceOfferImage,
} from '../../domain/entities/marketplace-offer.types';
import { MarketplaceBarcodeStrategyEnum } from './marketplace-inventory.dto';

export { MarketplaceBarcodeStrategyEnum };

export const MarketplaceOfferStatusEnum = MarketplaceOfferStatuses;
export type MarketplaceOfferStatusEnum =
  (typeof MarketplaceOfferStatusEnum)[keyof typeof MarketplaceOfferStatusEnum];
registerEnumType(MarketplaceOfferStatusEnum, {
  name: 'MarketplaceOfferStatus',
  description:
    'Этап модерации предложения: PENDING_MODERATION — на модерации, ACTIVE — опубликовано, ' +
    'REJECTED — отклонено, WITHDRAWN — снято поставщиком.',
});

export const MarketplaceUnitOfMeasureEnum = MarketplaceUnitsOfMeasure;
export type MarketplaceUnitOfMeasureEnum =
  (typeof MarketplaceUnitOfMeasureEnum)[keyof typeof MarketplaceUnitOfMeasureEnum];
registerEnumType(MarketplaceUnitOfMeasureEnum, {
  name: 'MarketplaceUnitOfMeasure',
  description:
    'Базовая единица измерения товара: piece — штука, kg — килограмм, liter — литр. ' +
    'Фасовка (например, заказ по 100 г или упаковками по 8 штук) задаётся отдельно ' +
    'размером единицы заказа.',
});

@ObjectType('MarketplaceOfferImage')
export class MarketplaceOfferImageDTO {
  @Field(() => String, {
    description: 'HMAC-подписанный URL для чтения изображения (TTL ограничен).',
  })
  public readonly url!: string;

  @Field(() => String, {
    description:
      'Ключ объекта в хранилище — стабильный идентификатор изображения. ' +
      'Передаётся обратно при редактировании, чтобы сохранить уже загруженное ' +
      'изображение (в отличие от base64 для новых файлов).',
  })
  public readonly bucket_key!: string;

  @Field(() => String, { description: 'MIME-тип изображения.' })
  public readonly mime_type!: string;

  @Field(() => Int, { description: 'Порядковый номер показа (0 — обложка).' })
  public readonly sort_order!: number;

  @Field(() => Boolean, { description: 'Является ли изображение обложкой карточки.' })
  public readonly is_cover!: boolean;

  constructor(init: Partial<MarketplaceOfferImageDTO>) {
    Object.assign(this, init);
  }
}

@ObjectType('MarketplaceOfferDeliveryPoint')
export class MarketplaceOfferDeliveryPointDTO {
  @Field(() => String, { description: 'Кооперативный участок (ПВЗ) поставки.' })
  public readonly braname!: string;

  @Field(() => Float, {
    description:
      'Минимальный объём, от которого поставщик готов везти на этот участок ' +
      '(в единицах товара). Ориентир для накопления партии, не жёсткий порог.',
  })
  public readonly min_supply_volume!: number;

  constructor(init: Partial<MarketplaceOfferDeliveryPointDTO>) {
    Object.assign(this, init);
  }
}

@ObjectType('MarketplaceOffer')
export class MarketplaceOfferDTO {
  @Field(() => String) public readonly id!: string;
  @Field(() => String) public readonly coopname!: string;
  @Field(() => String) public readonly supplier_account!: string;
  @Field(() => String) public readonly vitrine_id!: string;

  @Field(() => String) public readonly product_name!: string;
  @Field(() => String, { nullable: true }) public readonly description!: string | null;
  @Field(() => Int) public readonly category_id!: number;

  @Field(() => String, {
    description:
      'Цена за одну единицу заказа (фасовку). numeric как string.',
  })
  public readonly price_per_unit!: string;

  @Field(() => MarketplaceUnitOfMeasureEnum, {
    description: 'Базовая единица измерения товара (штука, килограмм, литр).',
  })
  public readonly unit_of_measure!: MarketplaceUnitOfMeasureEnum;

  @Field(() => String, {
    description:
      'Размер единицы заказа (фасовки) в базовых единицах: сколько базовых единиц ' +
      'входит в одну единицу заказа. Например, «0.1» — заказ по 100 г, «8» — упаковка ' +
      'из 8 штук, «1» — поштучно/на развес по базовой единице. numeric как string.',
  })
  public readonly order_unit_size!: string;

  @Field(() => Float) public readonly quantity_available!: number;
  @Field(() => Float) public readonly quantity_blocked!: number;
  @Field(() => Float) public readonly quantity_consumed!: number;
  @Field(() => Boolean) public readonly unlimited_flag!: boolean;

  @Field(() => [MarketplaceOfferDeliveryPointDTO], {
    description: 'КУ поставки с минимальным объёмом на каждом.',
  })
  public readonly delivery_points!: MarketplaceOfferDeliveryPointDTO[];
  @Field(() => Int, {
    description: 'Срок годности имущества в днях (основа списания скоропорта). Задаёт поставщик.',
  })
  public readonly shelf_life_days!: number;
  @Field(() => Int, {
    description: 'Гарантийный срок возврата в днях (окно возврата имущества). Задаёт модератор при одобрении.',
  })
  public readonly warranty_days!: number;

  @Field(() => MarketplaceBarcodeStrategyEnum, {
    description: 'Стратегия маркировки штрих-кодом для приёмки на КУ',
  })
  public readonly barcode_strategy!: MarketplaceBarcodeStrategyEnum;

  @Field(() => Int, {
    nullable: true,
    description: 'Размер упаковки для стратегии «по упаковке» (целое число > 0)',
  })
  public readonly pack_size!: number | null;

  @Field(() => String, {
    nullable: true,
    description:
      'Заполнено — предложение кооператива со склада этого участка (исполнение мгновенное, без цикла поставки).',
  })
  public readonly stock_braname!: string | null;

  @Field(() => MarketplaceOfferStatusEnum)
  public readonly status!: MarketplaceOfferStatusEnum;

  @Field(() => String, { nullable: true }) public readonly approved_by!: string | null;
  @Field(() => Date, { nullable: true }) public readonly approved_at!: Date | null;
  @Field(() => String, { nullable: true }) public readonly rejected_by!: string | null;
  @Field(() => Date, { nullable: true }) public readonly rejected_at!: Date | null;
  @Field(() => String, { nullable: true }) public readonly reject_reason!: string | null;

  @Field(() => Date) public readonly created_at!: Date;
  @Field(() => Date) public readonly updated_at!: Date;

  /**
   * Сырые записи изображений (ключи bucket'а) — НЕ экспонируются в схему.
   * Поле `images: [MarketplaceOfferImage]` резолвится лениво в
   * `MarketplaceOfferFieldResolver.images`, который превращает ключи в
   * HMAC-signed URL'ы. Так URL не считается в каждом list-резолвере, а только
   * когда клиент реально запрашивает `images`.
   */
  public readonly image_records?: MarketplaceOfferImage[];

  constructor(init: Partial<MarketplaceOfferDTO>) {
    Object.assign(this, init);
  }
}

@ObjectType('MarketplaceOfferPaginationResult')
export class MarketplaceOfferPaginationResultDTO extends createPaginationResult(
  MarketplaceOfferDTO,
  'MarketplaceOffer'
) {}

export function toMarketplaceOfferDTO(o: MarketplaceOfferDomainEntity): MarketplaceOfferDTO {
  return new MarketplaceOfferDTO({
    id: o.id,
    coopname: o.coopname,
    supplier_account: o.supplier_account,
    vitrine_id: o.vitrine_id,
    product_name: o.product_name,
    description: o.description,
    category_id: o.category_id,
    price_per_unit: o.price_per_unit,
    unit_of_measure: o.unit_of_measure as MarketplaceUnitOfMeasureEnum,
    order_unit_size: o.order_unit_size,
    quantity_available: o.quantity_available,
    quantity_blocked: o.quantity_blocked,
    quantity_consumed: o.quantity_consumed,
    unlimited_flag: o.unlimited_flag,
    delivery_points: (o.delivery_points ?? []).map(
      (d) => new MarketplaceOfferDeliveryPointDTO(d)
    ),
    shelf_life_days: o.shelf_life_days,
    warranty_days: o.warranty_days,
    barcode_strategy: o.barcode_strategy as MarketplaceBarcodeStrategyEnum,
    pack_size: o.pack_size,
    stock_braname: o.stock_braname,
    image_records: o.images ?? [],
    status: o.status,
    approved_by: o.approved_by,
    approved_at: o.approved_at,
    rejected_by: o.rejected_by,
    rejected_at: o.rejected_at,
    reject_reason: o.reject_reason,
    created_at: o.created_at,
    updated_at: o.updated_at,
  });
}

@ObjectType('MarketplaceCategory')
export class MarketplaceCategoryDTO {
  @Field(() => Int) public readonly id!: number;
  @Field(() => String) public readonly display_name!: string;
  @Field(() => Int) public readonly sort_order!: number;
  @Field(() => Boolean) public readonly mvp_baseline!: boolean;

  constructor(init: {
    id: number;
    display_name: string;
    sort_order: number;
    mvp_baseline: boolean;
  }) {
    this.id = init.id;
    this.display_name = init.display_name;
    this.sort_order = init.sort_order;
    this.mvp_baseline = init.mvp_baseline;
  }
}
