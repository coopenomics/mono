import { Field, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
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
  RECEIVED = 'RECEIVED',
  LABELED = 'LABELED',
  ISSUED = 'ISSUED',
  RETURNED = 'RETURNED',
  WRITTEN_OFF = 'WRITTEN_OFF',
}

registerEnumType(MarketplaceInventoryStatusEnum, {
  name: 'MarketplaceInventoryStatus',
  description: 'Состояние единицы имущества на складе КУ.',
});

@ObjectType('MarketplaceInventoryItem')
export class MarketplaceInventoryItemDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { description: 'Кооператив, на складе которого лежит имущество.' })
  coopname!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Штрих-код позиции (если наклеен). Пусто — позиция ещё не промаркирована.',
  })
  barcode_value!: string | null;

  @Field(() => MarketplaceBarcodeFormatEnum, { nullable: true })
  barcode_format!: MarketplaceBarcodeFormatEnum | null;

  @Field(() => ID, { description: 'Заказ, к которому относится позиция.' })
  order_id!: string;

  @Field(() => ID, { description: 'Партия поставки, в составе которой имущество получено.' })
  shipment_id!: string;

  @Field(() => String, { description: 'КУ-получатель имущества.' })
  braname!: string;

  @Field(() => MarketplaceInventoryStatusEnum)
  status!: MarketplaceInventoryStatusEnum;

  @Field(() => String, { description: 'Наименование товара — для печатной наклейки.' })
  product_name_snapshot!: string;

  @Field(() => Int, { description: 'Количество единиц имущества в этой позиции склада.' })
  quantity_per_label!: number;

  @Field(() => String, { description: 'Заказчик — печатается на наклейке.' })
  orderer_account_snapshot!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фамилия Имя Отчество заказчика (организация — краткое наименование). Для показа в списках вместо служебного имени аккаунта.',
  })
  orderer_name!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Полка/ячейка склада, куда положена позиция. Пусто — место не назначено.',
  })
  shelf!: string | null;

  @Field(() => Date, { description: 'Момент приёмки имущества кооперативом по акту.' })
  received_at!: Date;

  @Field(() => String, { description: 'Оператор КУ, оформивший приёмку.' })
  received_by_operator_account!: string;

  @Field(() => Date, { nullable: true, description: 'Момент маркировки штрих-кодом (если есть).' })
  labeled_at!: Date | null;

  @Field(() => String, {
    nullable: true,
    description: 'Оператор КУ, наклеивший штрих-код (если позиция промаркирована).',
  })
  labeled_by_operator_account!: string | null;

  @Field(() => Date)
  created_at!: Date;

  @Field(() => Date)
  updated_at!: Date;
}

@InputType('MarketplaceGenerateInventoryLabelInput')
export class MarketplaceGenerateInventoryLabelInputDTO {
  @Field(() => ID, { description: 'Позиция склада, на которую наклеивается штрих-код.' })
  @IsString()
  @IsNotEmpty()
  inventory_id!: string;

  @Field(() => MarketplaceBarcodeFormatEnum, {
    nullable: true,
    description: 'Формат штрих-кода. По умолчанию — EAN-13.',
  })
  @IsOptional()
  @IsEnum(MarketplaceBarcodeFormatEnum)
  format?: MarketplaceBarcodeFormatEnum;
}

@InputType('MarketplaceBindInventoryBarcodeInput')
export class MarketplaceBindInventoryBarcodeInputDTO {
  @Field(() => ID, { description: 'Позиция склада, к которой привязывается отсканированный штрих-код.' })
  @IsString()
  @IsNotEmpty()
  inventory_id!: string;

  @Field(() => String, {
    description:
      'Значение штрих-кода с заранее напечатанной этикетки (считанное сканером или введённое вручную).',
  })
  @IsString()
  @IsNotEmpty()
  barcode_value!: string;

  @Field(() => MarketplaceBarcodeFormatEnum, {
    nullable: true,
    description: 'Формат штрих-кода. По умолчанию — EAN-13.',
  })
  @IsOptional()
  @IsEnum(MarketplaceBarcodeFormatEnum)
  format?: MarketplaceBarcodeFormatEnum;
}

@InputType('MarketplaceAssignInventoryShelfInput')
export class MarketplaceAssignInventoryShelfInputDTO {
  @Field(() => ID, { description: 'Позиция склада, для которой назначается полка.' })
  @IsString()
  @IsNotEmpty()
  inventory_id!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Полка/ячейка склада (свободная строка). Пусто — очистить полку.',
  })
  @IsOptional()
  @IsString()
  shelf?: string | null;
}

@InputType('MarketplaceInventorySplitEntryInput')
export class MarketplaceInventorySplitEntryInputDTO {
  @Field(() => Int, { description: 'Количество единиц в этой доле.' })
  @IsInt()
  @Min(1)
  quantity!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Полка/ячейка склада для этой доли (свободная строка).',
  })
  @IsOptional()
  @IsString()
  shelf?: string | null;
}

@InputType('MarketplaceSplitInventoryInput')
export class MarketplaceSplitInventoryInputDTO {
  @Field(() => ID, { description: 'Позиция склада, которую раскладывают по нескольким полкам.' })
  @IsString()
  @IsNotEmpty()
  inventory_id!: string;

  @Field(() => [MarketplaceInventorySplitEntryInputDTO], {
    description: 'Доли разбиения; сумма количеств обязана равняться количеству позиции.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketplaceInventorySplitEntryInputDTO)
  splits!: MarketplaceInventorySplitEntryInputDTO[];
}

@ObjectType('MarketplaceInventoryMutationResult')
export class MarketplaceInventoryMutationResultDTO {
  @Field(() => [MarketplaceInventoryItemDTO], {
    description: 'Затронутые позиции склада после операции.',
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
    description: 'Фильтр по состояниям склада.',
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
  dto.barcode_format = e.barcode_format as MarketplaceBarcodeFormatEnum | null;
  dto.order_id = e.order_id;
  dto.shipment_id = e.shipment_id;
  dto.braname = e.braname;
  dto.status = e.status as MarketplaceInventoryStatusEnum;
  dto.product_name_snapshot = e.product_name_snapshot;
  dto.quantity_per_label = e.quantity_per_label;
  dto.orderer_account_snapshot = e.orderer_account_snapshot;
  // ФИО заказчика резолвится на read-path (резолвер списка), не хранится снимком —
  // как orderer_name в ленте заказов. По умолчанию null, дозаполняется батчем.
  dto.orderer_name = null;
  dto.shelf = e.shelf;
  dto.received_at = e.received_at;
  dto.received_by_operator_account = e.received_by_operator_account;
  dto.labeled_at = e.labeled_at;
  dto.labeled_by_operator_account = e.labeled_by_operator_account;
  dto.created_at = e.created_at;
  dto.updated_at = e.updated_at;
  return dto;
}
