import { Field, InputType, Int } from '@nestjs/graphql';
import {
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
} from 'class-validator';
import { PaginationInputDTO } from '~/application/common/dto/pagination.dto';
import { MarketplaceBarcodeStrategyEnum } from './marketplace-offer.dto';

const CYCLE_TYPES = ['time_based', 'volume_based', 'open_subscription', 'individual'] as const;
const UNITS = ['piece', 'kg', 'liter', 'pack'] as const;

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

  @Field(() => String, { description: 'time_based | volume_based | open_subscription | individual' })
  @IsIn(CYCLE_TYPES as unknown as string[])
  public cycle_type!: 'time_based' | 'volume_based' | 'open_subscription' | 'individual';

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  public cycle_days!: number | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  public target_volume!: number | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  public max_wait_days!: number | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  public min_threshold!: number | null;

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
  public cycle_type?: 'time_based' | 'volume_based' | 'open_subscription' | 'individual';

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  public cycle_days?: number | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  public target_volume?: number | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  public max_wait_days?: number | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  public min_threshold?: number | null;

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
}

@InputType('MarketplaceWithdrawOfferInput')
export class MarketplaceWithdrawOfferInputDTO {
  @Field(() => String)
  @IsString()
  public id!: string;
}

@InputType('MarketplaceListMyOffersInput')
export class MarketplaceListMyOffersInputDTO extends PaginationInputDTO {}
