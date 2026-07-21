import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
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

export enum MarketplaceInventoryOwnershipEnum {
  ORDER = 'ORDER',
  COOP = 'COOP',
}

registerEnumType(MarketplaceInventoryOwnershipEnum, {
  name: 'MarketplaceInventoryOwnership',
  description:
    'Принадлежность позиции склада: адресная под заказ пайщика (ORDER) либо обезличенный остаток кооператива (COOP).',
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
  @Field(() => String)
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

  @Field(() => String, { description: 'Заказ, к которому относится позиция.' })
  order_id!: string;

  @Field(() => String, { description: 'Партия поставки, в составе которой имущество получено.' })
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
    description: 'Единица измерения товара (шт./кг/литр/упак.) — из предложения. Для подписей количества на складе.',
  })
  unit_of_measure!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Наименование пункта выдачи (КУ), где лежит имущество. Для показа в списках вместо служебного имени участка.',
  })
  delivery_point_name!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Адрес пункта выдачи (КУ), где лежит имущество.',
  })
  delivery_point_address!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Полка/ячейка склада, куда положена позиция. Пусто — место не назначено.',
  })
  shelf!: string | null;

  @Field(() => Date, { description: 'Момент приёмки имущества кооперативом по акту.' })
  received_at!: Date;

  @Field(() => Date, {
    nullable: true,
    description: 'Срок годности имущества. По нему идёт списание просрочки — ключевой параметр контроля склада. Пусто — срок не задан.',
  })
  expiry_date!: Date | null;

  @Field(() => String, { description: 'Оператор КУ, оформивший приёмку.' })
  received_by_operator_account!: string;

  @Field(() => Date, { nullable: true, description: 'Момент маркировки штрих-кодом (если есть).' })
  labeled_at!: Date | null;

  @Field(() => String, {
    nullable: true,
    description: 'Оператор КУ, наклеивший штрих-код (если позиция промаркирована).',
  })
  labeled_by_operator_account!: string | null;

  @Field(() => MarketplaceInventoryOwnershipEnum, {
    description: 'Принадлежность: адресная позиция заказа или обезличенный остаток кооператива.',
  })
  ownership!: MarketplaceInventoryOwnershipEnum;

  @Field(() => String, {
    nullable: true,
    description: 'Цена прибытия за единицу (закупочная из акта приёмки) — база цены публикации остатка.',
  })
  arrival_price!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Предложение кооператива, которым остаток опубликован в каталоге. Пусто — не опубликован.',
  })
  published_offer_id!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Заказ со склада кооператива, под который позиция зарезервирована. Пусто — свободна.',
  })
  reserved_order_id!: string | null;

  @Field(() => Date)
  created_at!: Date;

  @Field(() => Date)
  updated_at!: Date;
}

@InputType('MarketplaceGenerateInventoryLabelInput')
export class MarketplaceGenerateInventoryLabelInputDTO {
  @Field(() => String, { description: 'Позиция склада, на которую наклеивается штрих-код.' })
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
  @Field(() => String, { description: 'Позиция склада, к которой привязывается отсканированный штрих-код.' })
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
  @Field(() => String, { description: 'Позиция склада, для которой назначается полка.' })
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

@InputType('MarketplaceClearInventoryLabelInput')
export class MarketplaceClearInventoryLabelInputDTO {
  @Field(() => String, { description: 'Позиция склада, с которой снимается штрих-код (для переклейки).' })
  @IsString()
  @IsNotEmpty()
  inventory_id!: string;
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
  @Field(() => String, { description: 'Позиция склада, которую раскладывают по нескольким полкам.' })
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
  @Field(() => String, { nullable: true, description: 'Фильтр по заказу.' })
  @IsOptional()
  @IsString()
  order_id?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по партии поставки.' })
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
  // ФИО заказчика, единица измерения и реквизиты ПВЗ резолвятся на read-path
  // (резолвер списка) батчем по заказам — не хранятся снимком. По умолчанию null.
  dto.orderer_name = null;
  dto.unit_of_measure = null;
  dto.delivery_point_name = null;
  dto.delivery_point_address = null;
  dto.shelf = e.shelf;
  dto.received_at = e.received_at;
  dto.expiry_date = e.expiry_date;
  dto.received_by_operator_account = e.received_by_operator_account;
  dto.labeled_at = e.labeled_at;
  dto.labeled_by_operator_account = e.labeled_by_operator_account;
  dto.ownership = e.ownership as MarketplaceInventoryOwnershipEnum;
  dto.arrival_price = e.arrival_price;
  dto.published_offer_id = e.published_offer_id;
  dto.reserved_order_id = e.reserved_order_id;
  dto.created_at = e.created_at;
  dto.updated_at = e.updated_at;
  return dto;
}
