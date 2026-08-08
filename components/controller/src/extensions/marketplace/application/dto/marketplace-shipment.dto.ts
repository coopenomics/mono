import { Field, Int, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { MarketplaceShipmentDomainEntity } from '../../domain/entities/marketplace-shipment.entity';
import {
  MarketplaceShipmentDeliveryVariant,
  MarketplaceShipmentStatus,
} from '../../domain/entities/marketplace-shipment.types';

export enum MarketplaceShipmentDeliveryVariantEnum {
  SELF = 'A',
  EXPEDITOR = 'B',
}

registerEnumType(MarketplaceShipmentDeliveryVariantEnum, {
  name: 'MarketplaceShipmentDeliveryVariant',
  description:
    'Вариант доставки партии на КУ: A — поставщик везёт лично, B — экспедитор по ТТН.',
});

export enum MarketplaceShipmentStatusEnum {
  DRAFT = 'DRAFT',
  SUPPLY_PREPARED = 'SUPPLY_PREPARED',
  RECEPTION_IN_PROGRESS = 'RECEPTION_IN_PROGRESS',
  ACCEPTED_TO_COOP = 'ACCEPTED_TO_COOP',
  CANCELLED = 'CANCELLED',
}

registerEnumType(MarketplaceShipmentStatusEnum, {
  name: 'MarketplaceShipmentStatus',
  description: 'Статус партии поставки.',
});

// Данные экспедитора необязательны (см. Input-DTO ниже) — поэтому при чтении
// партии любое из полей может отсутствовать. Все nullable, иначе GraphQL падает
// на сериализации частично заполненного ttn_data.
// Экспедиторская упаковка строки партии: сколько единиц в одной коробке.
// Задаётся при формировании партии; число коробок выводится из количества.
@ObjectType('MarketplaceShipmentLinePackaging')
export class MarketplaceShipmentLinePackagingDTO {
  @Field(() => String, { description: 'Заказ партии, к которому относится упаковка.' })
  order_id!: string;
  @Field(() => Int, { description: 'Сколько единиц имущества в одной коробке.' })
  units_per_box!: number;
}

@ObjectType('MarketplaceShipmentTTNData')
export class MarketplaceShipmentTTNDataDTO {
  @Field(() => String, { nullable: true, description: 'ФИО экспедитора.' })
  expeditor_full_name?: string;
  @Field(() => String, { nullable: true, description: 'Контактный телефон экспедитора.' })
  expeditor_phone?: string;
  @Field(() => String, { nullable: true, description: 'Госномер транспортного средства.' })
  vehicle_number?: string;
  @Field(() => String, { nullable: true, description: 'Адрес погрузки (склад поставщика).' })
  loading_address?: string;
  @Field(() => String, { nullable: true, description: 'Дата и время погрузки (ISO).' })
  loading_datetime?: string;
  @Field(() => String, { nullable: true, description: 'Расчётная дата и время доставки на КУ (ISO).' })
  delivery_datetime_estimate?: string;
  @Field(() => [MarketplaceShipmentLinePackagingDTO], {
    nullable: true,
    description: 'Упаковка по строкам партии: сколько единиц в коробке на каждый заказ.',
  })
  packaging?: MarketplaceShipmentLinePackagingDTO[];
}

// Все поля данных экспедитора — НЕОБЯЗАТЕЛЬНЫЕ. ТТН не подписывается ЭЦП и не
// идёт в реестр кооператива; заполняем, что известно о перевозчике, а пустое
// просто не попадёт в документ. Раньше @IsNotEmpty на каждом поле блокировал
// формирование партии («ttn_data.<поле> should not be empty»), хотя сама форма
// заявлена как опциональная. Паспорт экспедитора в цифровой системе НЕ хранится
// (минимизация ПДн) — собираем только то, что печатается в ТТН.
// Упаковка строки партии — вход. Задаётся поставщиком при формировании партии
// (для каждого заказа: сколько единиц в коробке).
@InputType('MarketplaceShipmentLinePackagingInput')
export class MarketplaceShipmentLinePackagingInputDTO {
  @Field(() => String, { description: 'Заказ партии, к которому относится упаковка.' })
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @Field(() => Int, { description: 'Сколько единиц имущества в одной коробке.' })
  @IsInt()
  @Min(1)
  units_per_box!: number;
}

@InputType('MarketplaceShipmentTTNDataInput')
export class MarketplaceShipmentTTNDataInputDTO {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  expeditor_full_name?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  expeditor_phone?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  vehicle_number?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  loading_address?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  loading_datetime?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  delivery_datetime_estimate?: string;

  @Field(() => [MarketplaceShipmentLinePackagingInputDTO], {
    nullable: true,
    description: 'Упаковка по строкам партии: сколько единиц в коробке на каждый заказ.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketplaceShipmentLinePackagingInputDTO)
  packaging?: MarketplaceShipmentLinePackagingInputDTO[];
}

@ObjectType('MarketplaceShipment')
export class MarketplaceShipmentDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String, { description: 'Кооператив, в котором сформирована партия.' })
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор консолидированной заявки.' })
  cycle_id!: string;

  @Field(() => String, { description: 'Account поставщика-владельца Offer\'ов.' })
  offerer_account!: string;

  @Field(() => String, { description: 'КУ-получатель партии.' })
  braname!: string;

  @Field(() => MarketplaceShipmentDeliveryVariantEnum, {
    description: 'Выбранный вариант доставки.',
  })
  delivery_variant!: MarketplaceShipmentDeliveryVariantEnum;

  @Field(() => String, {
    description: 'Сумма по партии (numeric с 4 знаками после запятой).',
  })
  total_amount!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Уникальный номер ТТН для Варианта Б (печатается на наклейке).',
  })
  ttn_number!: string | null;

  @Field(() => MarketplaceShipmentTTNDataDTO, {
    nullable: true,
    description: 'Поля ТТН — экспедитор, транспорт, погрузка, доставка.',
  })
  ttn_data!: MarketplaceShipmentTTNDataDTO | null;

  @Field(() => String, {
    nullable: true,
    description: 'Идентификатор записи ТТН в локальном реестре marketplace_ttn_document.',
  })
  ttn_document_id!: string | null;

  @Field(() => MarketplaceShipmentStatusEnum)
  status!: MarketplaceShipmentStatusEnum;

  @Field(() => Date)
  created_at!: Date;

  @Field(() => Date)
  updated_at!: Date;
}

@InputType('MarketplaceShipmentGroupInput')
export class MarketplaceShipmentGroupInputDTO {
  @Field(() => String, { description: 'Идентификатор КУ-получателя (branch.name).' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => MarketplaceShipmentDeliveryVariantEnum)
  @IsEnum(MarketplaceShipmentDeliveryVariantEnum)
  delivery_variant!: MarketplaceShipmentDeliveryVariantEnum;

  @Field(() => [String], {
    nullable: true,
    description:
      'Подмножество заказов этого КУ, реально погружаемых в партию (частичная отгрузка). ' +
      'Пусто → все акцептованные заказы КУ (поведение по умолчанию). Невключённые заказы ' +
      'остаются ACCEPTED и доступны для следующей партии.',
  })
  @IsOptional()
  @IsArray()
  order_ids?: string[];

  @Field(() => MarketplaceShipmentTTNDataInputDTO, {
    nullable: true,
    description: 'Поля ТТН — обязательны для Варианта Б.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MarketplaceShipmentTTNDataInputDTO)
  ttn_data?: MarketplaceShipmentTTNDataInputDTO;
}

@InputType('MarketplaceCreateShipmentInput')
export class MarketplaceCreateShipmentInputDTO {
  @Field(() => String, { description: 'Идентификатор консолидированной заявки в статусе ACCEPTED.' })
  @IsString()
  @IsNotEmpty()
  cycle_id!: string;

  @Field(() => [MarketplaceShipmentGroupInputDTO], {
    description:
      'Группы доставки по КУ заявки. Каждая группа = одна партия (один КУ, один вариант ' +
      'доставки, опционально подмножество заказов). Покрытие всех КУ заявки не требуется — ' +
      'можно формировать частично и догружать остаток отдельными партиями.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketplaceShipmentGroupInputDTO)
  groups!: MarketplaceShipmentGroupInputDTO[];
}

@ObjectType('MarketplaceCreateShipmentResult')
export class MarketplaceCreateShipmentResultDTO {
  @Field(() => [MarketplaceShipmentDTO], {
    description: 'Созданные партии — по одной на каждую группу доставки во входе.',
  })
  shipments!: MarketplaceShipmentDTO[];
}

@InputType('MarketplaceGetShipmentInput')
export class MarketplaceGetShipmentInputDTO {
  @Field(() => String, { description: 'Идентификатор партии поставки.' })
  @IsString()
  @IsNotEmpty()
  shipment_id!: string;
}

@InputType('MarketplaceListShipmentsInput')
export class MarketplaceListShipmentsInputDTO {
  @Field(() => String, { nullable: true, description: 'Фильтр по консолидированной заявке.' })
  @IsOptional()
  @IsString()
  cycle_id?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по КУ-получателю.' })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field(() => [MarketplaceShipmentStatusEnum], {
    nullable: true,
    description: 'Фильтр по статусам партий.',
  })
  @IsOptional()
  @IsArray()
  statuses?: MarketplaceShipmentStatusEnum[];
}

@InputType('MarketplaceListShipmentsByBranameInput')
export class MarketplaceListShipmentsByBranameInputDTO {
  @Field(() => String, { description: 'Кооперативный участок получения партий.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => [MarketplaceShipmentStatusEnum], {
    nullable: true,
    description: 'Фильтр по статусам партий — например, ожидаемые к приёмке.',
  })
  @IsOptional()
  @IsArray()
  statuses?: MarketplaceShipmentStatusEnum[];
}

export function toMarketplaceShipmentDTO(
  e: MarketplaceShipmentDomainEntity
): MarketplaceShipmentDTO {
  const dto = new MarketplaceShipmentDTO();
  dto.id = e.id;
  dto.coopname = e.coopname;
  dto.cycle_id = e.cycle_id;
  dto.offerer_account = e.offerer_account;
  dto.braname = e.braname;
  dto.delivery_variant = e.delivery_variant as MarketplaceShipmentDeliveryVariantEnum;
  dto.total_amount = e.total_amount;
  dto.ttn_number = e.ttn_number;
  dto.ttn_data = e.ttn_data
    ? Object.assign(new MarketplaceShipmentTTNDataDTO(), e.ttn_data)
    : null;
  dto.ttn_document_id = e.ttn_document_id;
  dto.status = e.status as MarketplaceShipmentStatusEnum;
  dto.created_at = e.created_at;
  dto.updated_at = e.updated_at;
  return dto;
}

// Re-export raw enums (для использования в backend mapping).
export { MarketplaceShipmentDeliveryVariant, MarketplaceShipmentStatus };
