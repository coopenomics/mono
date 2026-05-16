import { Field, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import type { MarketplaceInventoryDomainEntity } from '../../domain/entities/marketplace-inventory.entity';

export enum MarketplaceBarcodeFormatEnum {
  CODE128 = 'CODE128',
  EAN13 = 'EAN13',
}

registerEnumType(MarketplaceBarcodeFormatEnum, {
  name: 'MarketplaceBarcodeFormat',
  description:
    'Формат штрих-кода маркировки имущества: CODE128 (буквенно-цифровой) или EAN-13 (13 цифр).',
});

export enum MarketplaceBarcodeStrategyEnum {
  PER_ORDER = 'PER_ORDER',
  PER_UNIT = 'PER_UNIT',
  PER_PACKAGE = 'PER_PACKAGE',
}

registerEnumType(MarketplaceBarcodeStrategyEnum, {
  name: 'MarketplaceBarcodeStrategy',
  description:
    'Стратегия маркировки: одна этикетка на заказ, на единицу, или на упаковку.',
});

export enum MarketplaceInventoryStatusEnum {
  LABELED = 'LABELED',
  ISSUED = 'ISSUED',
  RETURNED = 'RETURNED',
  WRITTEN_OFF = 'WRITTEN_OFF',
}

registerEnumType(MarketplaceInventoryStatusEnum, {
  name: 'MarketplaceInventoryStatus',
  description: 'Состояние единицы имущества в инвентаре КУ.',
});

@ObjectType('MarketplaceInventoryItem')
export class MarketplaceInventoryItemDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { description: 'Кооператив, в котором ведётся инвентарь.' })
  coopname!: string;

  @Field(() => String, {
    description: 'Значение штрих-кода на наклейке (распознаётся сканером при выдаче).',
  })
  barcode_value!: string;

  @Field(() => MarketplaceBarcodeFormatEnum)
  barcode_format!: MarketplaceBarcodeFormatEnum;

  @Field(() => ID, { description: 'Заказ, к единицам которого относится наклейка.' })
  order_id!: string;

  @Field(() => ID, { description: 'Партия поставки, в составе которой имущество получено.' })
  shipment_id!: string;

  @Field(() => String, { description: 'КУ-получатель имущества.' })
  braname!: string;

  @Field(() => MarketplaceInventoryStatusEnum)
  status!: MarketplaceInventoryStatusEnum;

  @Field(() => String, { description: 'Снапшот наименования товара — для печатной наклейки.' })
  product_name_snapshot!: string;

  @Field(() => Int, {
    description: 'Сколько единиц имущества учитывает эта этикетка (1 для PER_UNIT, N для PER_PACKAGE).',
  })
  quantity_per_label!: number;

  @Field(() => String, { description: 'Account заказчика — печатается на наклейке.' })
  orderer_account_snapshot!: string;

  @Field(() => Date)
  labeled_at!: Date;

  @Field(() => String, { description: 'Account оператора КУ, наклеившего этикетку.' })
  labeled_by_operator_account!: string;

  @Field(() => Date)
  created_at!: Date;

  @Field(() => Date)
  updated_at!: Date;
}

@InputType('MarketplaceLabelInventoryInput')
export class MarketplaceLabelInventoryInputDTO {
  @Field(() => ID, { description: 'Заказ, для которого формируются наклейки.' })
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @Field(() => MarketplaceBarcodeStrategyEnum, {
    nullable: true,
    description: 'Стратегия маркировки. По умолчанию — одна этикетка на весь заказ.',
  })
  @IsOptional()
  @IsEnum(MarketplaceBarcodeStrategyEnum)
  strategy?: MarketplaceBarcodeStrategyEnum;

  @Field(() => MarketplaceBarcodeFormatEnum, {
    nullable: true,
    description: 'Формат штрих-кода. По умолчанию — CODE128.',
  })
  @IsOptional()
  @IsEnum(MarketplaceBarcodeFormatEnum)
  format?: MarketplaceBarcodeFormatEnum;

  @Field(() => Int, {
    nullable: true,
    description: 'Размер упаковки — обязателен для стратегии PER_PACKAGE.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  pack_size?: number;
}

@ObjectType('MarketplaceLabelInventoryResult')
export class MarketplaceLabelInventoryResultDTO {
  @Field(() => [MarketplaceInventoryItemDTO], {
    description: 'Сгенерированные наклейки: одна или несколько в зависимости от стратегии.',
  })
  inventory!: MarketplaceInventoryItemDTO[];
}

@InputType('MarketplaceListInventoryInput')
export class MarketplaceListInventoryInputDTO {
  @Field(() => ID, { nullable: true, description: 'Фильтр по заказу.' })
  @IsOptional()
  @IsString()
  order_id?: string;

  @Field(() => ID, { nullable: true, description: 'Фильтр по партии поставки.' })
  @IsOptional()
  @IsString()
  shipment_id?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по КУ.' })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field(() => [MarketplaceInventoryStatusEnum], {
    nullable: true,
    description: 'Фильтр по состояниям инвентаря.',
  })
  @IsOptional()
  @IsArray()
  statuses?: MarketplaceInventoryStatusEnum[];
}

export function toMarketplaceInventoryItemDTO(
  e: MarketplaceInventoryDomainEntity
): MarketplaceInventoryItemDTO {
  const dto = new MarketplaceInventoryItemDTO();
  dto.id = e.id;
  dto.coopname = e.coopname;
  dto.barcode_value = e.barcode_value;
  dto.barcode_format = e.barcode_format as MarketplaceBarcodeFormatEnum;
  dto.order_id = e.order_id;
  dto.shipment_id = e.shipment_id;
  dto.braname = e.braname;
  dto.status = e.status as MarketplaceInventoryStatusEnum;
  dto.product_name_snapshot = e.product_name_snapshot;
  dto.quantity_per_label = e.quantity_per_label;
  dto.orderer_account_snapshot = e.orderer_account_snapshot;
  dto.labeled_at = e.labeled_at;
  dto.labeled_by_operator_account = e.labeled_by_operator_account;
  dto.created_at = e.created_at;
  dto.updated_at = e.updated_at;
  return dto;
}
