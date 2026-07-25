import { Field, Float, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationInputDTO } from '~/application/common/dto/pagination.dto';
import {
  MARKETPLACE_OFFER_MAX_IMAGES,
  MARKETPLACE_OFFER_MAX_PACKAGES,
} from '../../domain/entities/marketplace-offer.types';
import {
  MarketplaceBarcodeStrategyEnum,
  MarketplaceOfferStatusEnum,
  MarketplaceSaleFormEnum,
  MarketplaceUnitOfMeasureEnum,
} from './marketplace-offer.dto';

/** Технический предел числа КУ поставки на один Offer. */
const MARKETPLACE_OFFER_MAX_DELIVERY_POINTS = 100;

@InputType('MarketplaceOfferPackageInput')
export class MarketplaceOfferPackageInputDTO {
  @Field(() => Float, {
    description: 'Содержимое одной упаковки в базовой единице (0,5 л/кг; 12 шт).',
  })
  @IsNumber()
  @Min(0)
  public readonly size!: number;

  @Field(() => String, { description: 'Цена за одну упаковку (numeric-строка, до 4 знаков).' })
  @Matches(/^\d+(\.\d{1,4})?$/)
  public readonly price!: string;

  @Field(() => String, { nullable: true, description: 'Подпись упаковки («Пакет 0,5 л»).' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public readonly label?: string | null;

  @Field(() => Boolean, { nullable: true, description: 'Упаковка по умолчанию (для витрины).' })
  @IsOptional()
  @IsBoolean()
  public readonly is_default?: boolean;
}

@InputType('MarketplaceOfferDeliveryPointInput')
export class MarketplaceOfferDeliveryPointInputDTO {
  @Field(() => String, { description: 'Кооперативный участок (ПВЗ), на который поставщик готов везти.' })
  @IsString()
  @IsNotEmpty()
  public readonly braname!: string;

  @Field(() => Int, {
    description: 'Минимальный объём поставки на этот участок (в единицах товара, ≥ 1).',
  })
  @IsInt()
  @Min(1)
  public readonly min_supply_volume!: number;
}

@InputType('MarketplaceOfferImageUploadInput')
export class MarketplaceOfferImageUploadInputDTO {
  // Элемент набора изображений — ЛИБО новый файл (base64 + mime_type), ЛИБО
  // ссылка на уже сохранённое изображение по bucket_key (чтобы сохранить его
  // при пересборке набора). Порядок в массиве = порядок показа, первый —
  // обложка. Согласованность (ровно одно из двух) проверяется в сервисе.
  @Field({ nullable: true, description: 'Содержимое нового изображения в base64.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public readonly base64?: string;

  @Field({ nullable: true, description: 'MIME-тип нового изображения (image/jpeg, image/png либо image/webp).' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public readonly mime_type?: string;

  @Field({ nullable: true, description: 'Ключ уже сохранённого изображения — сохранить его в наборе.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public readonly bucket_key?: string;
}

@InputType('MarketplaceCreateOfferInput')
export class MarketplaceCreateOfferInputDTO {
  @Field(() => String)
  @IsNotEmpty()
  @MaxLength(200)
  public product_name!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(2000)
  public description!: string | null;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  public category_id!: number;

  @Field(() => String, {
    description:
      'Цена за базовую единицу товара (кг/л/шт) при отпуске по мере. numeric как string, до 4 знаков. При отпуске упаковкой цена задаётся у каждой упаковки.',
  })
  @Matches(/^\d+(\.\d{1,4})?$/)
  public price_per_unit!: string;

  @Field(() => MarketplaceUnitOfMeasureEnum, {
    description: 'Базовая единица измерения товара (штука, килограмм, литр).',
  })
  @IsEnum(MarketplaceUnitOfMeasureEnum)
  public unit_of_measure!: MarketplaceUnitOfMeasureEnum;

  @Field(() => MarketplaceSaleFormEnum, {
    nullable: true,
    description:
      'Способ отпуска: по мере (by_measure, по умолчанию) или упаковкой (packaged). ' +
      'При упаковкой обязателен непустой список упаковок.',
  })
  @IsOptional()
  @IsEnum(MarketplaceSaleFormEnum)
  public sale_form?: MarketplaceSaleFormEnum;

  @Field(() => [MarketplaceOfferPackageInputDTO], {
    nullable: true,
    description:
      'Каталог упаковок при отпуске упаковкой (у каждой своя цена). Обязателен и непуст при sale_form = packaged.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MARKETPLACE_OFFER_MAX_PACKAGES)
  @ValidateNested({ each: true })
  @Type(() => MarketplaceOfferPackageInputDTO)
  public packages?: MarketplaceOfferPackageInputDTO[];

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  public quantity_available!: number | null;

  @Field(() => Boolean)
  @IsBoolean()
  public unlimited_flag!: boolean;

  @Field(() => [MarketplaceOfferDeliveryPointInputDTO], {
    description:
      'КУ поставки с минимальным объёмом на каждом. Минимум один участок; ' +
      'min_supply_volume = 1 означает поставку по одному заказу, >1 — накопление партии.',
  })
  @IsArray()
  @ArrayMaxSize(MARKETPLACE_OFFER_MAX_DELIVERY_POINTS)
  @ValidateNested({ each: true })
  @Type(() => MarketplaceOfferDeliveryPointInputDTO)
  public delivery_points!: MarketplaceOfferDeliveryPointInputDTO[];

  @Field(() => Int, {
    description:
      'Срок годности имущества в днях. По нему рассчитывается списание ' +
      'скоропорта со склада. 0 — имущество без срока годности (не списывается).',
  })
  @IsInt()
  @Min(0)
  public shelf_life_days!: number;

  @Field(() => MarketplaceBarcodeStrategyEnum, {
    nullable: true,
    description:
      'Стратегия маркировки штрих-кодом при приёмке на КУ. По умолчанию «по заказу» (PER_ORDER).',
  })
  @IsOptional()
  @IsEnum(MarketplaceBarcodeStrategyEnum)
  public barcode_strategy?: MarketplaceBarcodeStrategyEnum;

  @Field(() => Int, {
    nullable: true,
    description: 'Размер упаковки для стратегии «по упаковке» (обязателен при PER_PACKAGE).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  public pack_size?: number;

  @Field(() => [MarketplaceOfferImageUploadInputDTO], {
    nullable: true,
    description:
      'Изображения товара (base64). Порядок = порядок показа, первое — обложка. До 8 файлов, каждый ≤ 10 МБ, JPEG/PNG/WEBP.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MARKETPLACE_OFFER_MAX_IMAGES)
  @ValidateNested({ each: true })
  @Type(() => MarketplaceOfferImageUploadInputDTO)
  public images?: MarketplaceOfferImageUploadInputDTO[];
}

@InputType('MarketplaceUpdateOfferInput')
export class MarketplaceUpdateOfferInputDTO {
  @Field(() => String)
  @IsString()
  public id!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(200)
  public product_name?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(2000)
  public description?: string | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  public category_id?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(/^\d+(\.\d{1,4})?$/)
  public price_per_unit?: string;

  @Field(() => MarketplaceUnitOfMeasureEnum, { nullable: true })
  @IsOptional()
  @IsEnum(MarketplaceUnitOfMeasureEnum)
  public unit_of_measure?: MarketplaceUnitOfMeasureEnum;

  @Field(() => MarketplaceSaleFormEnum, {
    nullable: true,
    description: 'Способ отпуска. Если передан packaged — требуется непустой список packages.',
  })
  @IsOptional()
  @IsEnum(MarketplaceSaleFormEnum)
  public sale_form?: MarketplaceSaleFormEnum;

  @Field(() => [MarketplaceOfferPackageInputDTO], {
    nullable: true,
    description: 'Каталог упаковок. Если передан — полностью заменяет текущий набор.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MARKETPLACE_OFFER_MAX_PACKAGES)
  @ValidateNested({ each: true })
  @Type(() => MarketplaceOfferPackageInputDTO)
  public packages?: MarketplaceOfferPackageInputDTO[];

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  public quantity_available?: number;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  public unlimited_flag?: boolean;

  @Field(() => [MarketplaceOfferDeliveryPointInputDTO], {
    nullable: true,
    description: 'КУ поставки с минимальным объёмом. Если передано — полностью заменяет набор.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MARKETPLACE_OFFER_MAX_DELIVERY_POINTS)
  @ValidateNested({ each: true })
  @Type(() => MarketplaceOfferDeliveryPointInputDTO)
  public delivery_points?: MarketplaceOfferDeliveryPointInputDTO[];

  @Field(() => Int, {
    nullable: true,
    description: 'Срок годности имущества в днях (основа списания скоропорта).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  public shelf_life_days?: number;

  @Field(() => MarketplaceBarcodeStrategyEnum, { nullable: true })
  @IsOptional()
  @IsEnum(MarketplaceBarcodeStrategyEnum)
  public barcode_strategy?: MarketplaceBarcodeStrategyEnum;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  public pack_size?: number | null;

  @Field(() => [MarketplaceOfferImageUploadInputDTO], {
    nullable: true,
    description:
      'Изображения товара (base64). Если передано — полностью заменяет текущий набор. До 8 файлов, каждый ≤ 10 МБ, JPEG/PNG/WEBP.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MARKETPLACE_OFFER_MAX_IMAGES)
  @ValidateNested({ each: true })
  @Type(() => MarketplaceOfferImageUploadInputDTO)
  public images?: MarketplaceOfferImageUploadInputDTO[];
}

@InputType('MarketplaceWithdrawOfferInput')
export class MarketplaceWithdrawOfferInputDTO {
  @Field(() => String)
  @IsString()
  public id!: string;
}

@InputType('MarketplaceRepublishOfferInput')
export class MarketplaceRepublishOfferInputDTO {
  @Field(() => String)
  @IsString()
  public id!: string;
}

@InputType('MarketplaceListMyOffersInput')
export class MarketplaceListMyOffersInputDTO extends PaginationInputDTO {}

@InputType('MarketplaceListAllOffersInput', {
  description: 'Параметры фильтрации реестра всех предложений кооператива (стол администратора).',
})
export class MarketplaceListAllOffersInputDTO extends PaginationInputDTO {
  @Field(() => [MarketplaceOfferStatusEnum], {
    nullable: true,
    description: 'Один или несколько статусов предложения, по которым нужно отфильтровать список.',
  })
  public readonly statuses?: MarketplaceOfferStatusEnum[];

  @Field(() => String, { nullable: true, description: 'Фильтр по аккаунту поставщика.' })
  public readonly supplier_account?: string;
}
