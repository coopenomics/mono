import { Field, Int, ObjectType } from '@nestjs/graphql';
import { createPaginationResult } from '~/application/common/dto/pagination.dto';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import type { MarketplaceOfferImage } from '../../domain/entities/marketplace-offer.types';
import { MarketplaceBarcodeStrategyEnum } from './marketplace-inventory.dto';

export { MarketplaceBarcodeStrategyEnum };

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

@ObjectType('MarketplaceOffer')
export class MarketplaceOfferDTO {
  @Field(() => String) public readonly id!: string;
  @Field(() => String) public readonly coopname!: string;
  @Field(() => String) public readonly supplier_account!: string;
  @Field(() => String) public readonly vitrine_id!: string;

  @Field(() => String) public readonly product_name!: string;
  @Field(() => String, { nullable: true }) public readonly description!: string | null;
  @Field(() => Int) public readonly category_id!: number;

  @Field(() => String, { description: 'Цена за единицу (numeric как string)' })
  public readonly price_per_unit!: string;

  @Field(() => String, { description: 'piece | kg | liter | pack' })
  public readonly unit_of_measure!: string;

  @Field(() => Int) public readonly quantity_available!: number;
  @Field(() => Int) public readonly quantity_blocked!: number;
  @Field(() => Int) public readonly quantity_consumed!: number;
  @Field(() => Boolean) public readonly unlimited_flag!: boolean;

  @Field(() => String, { description: 'Способ поставки: individual | collective' })
  public readonly cycle_type!: string;
  @Field(() => Int, { nullable: true, description: 'Целевой объём коллективной закупки (только collective).' })
  public readonly target_volume!: number | null;
  @Field(() => Int) public readonly warranty_days!: number;

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
    description: 'PENDING_MODERATION | ACTIVE | REJECTED | WITHDRAWN',
  })
  public readonly status!: string;

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
    unit_of_measure: o.unit_of_measure,
    quantity_available: o.quantity_available,
    quantity_blocked: o.quantity_blocked,
    quantity_consumed: o.quantity_consumed,
    unlimited_flag: o.unlimited_flag,
    cycle_type: o.cycle_type,
    target_volume: o.target_volume,
    warranty_days: o.warranty_days,
    barcode_strategy: o.barcode_strategy as MarketplaceBarcodeStrategyEnum,
    pack_size: o.pack_size,
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
