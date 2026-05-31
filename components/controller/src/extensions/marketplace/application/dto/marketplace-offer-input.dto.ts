import { Field, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
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
import { MARKETPLACE_OFFER_MAX_IMAGES } from '../../domain/entities/marketplace-offer.types';
import { MarketplaceBarcodeStrategyEnum } from './marketplace-offer.dto';

const CYCLE_TYPES = ['individual', 'collective'] as const;
const UNITS = ['piece', 'kg', 'liter', 'pack'] as const;

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
  @Max(9)
  public category_id!: number;

  @Field(() => String, { description: 'Цена за единицу (numeric как string, до 4 знаков)' })
  @Matches(/^\d+(\.\d{1,4})?$/)
  public price_per_unit!: string;

  @Field(() => String, { description: 'piece | kg | liter | pack' })
  @IsIn(UNITS as unknown as string[])
  public unit_of_measure!: 'piece' | 'kg' | 'liter' | 'pack';

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  public quantity_available!: number | null;

  @Field(() => Boolean)
  @IsBoolean()
  public unlimited_flag!: boolean;

  @Field(() => String, { description: 'Способ поставки: individual (индивидуально) | collective (коллективная закупка)' })
  @IsIn(CYCLE_TYPES as unknown as string[])
  public cycle_type!: 'individual' | 'collective';

  @Field(() => Int, {
    nullable: true,
    description:
      'Целевой объём коллективной закупки (опц.): набрался — партия стартует автоматически. Только для collective.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  public target_volume!: number | null;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  public warranty_days!: number;

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
  @Max(9)
  public category_id?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(/^\d+(\.\d{1,4})?$/)
  public price_per_unit?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsIn(UNITS as unknown as string[])
  public unit_of_measure?: 'piece' | 'kg' | 'liter' | 'pack';

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  public quantity_available?: number;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  public unlimited_flag?: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsIn(CYCLE_TYPES as unknown as string[])
  public cycle_type?: 'individual' | 'collective';

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  public target_volume?: number | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  public warranty_days?: number;

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
