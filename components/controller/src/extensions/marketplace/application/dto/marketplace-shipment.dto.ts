import { Field, ID, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
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

@ObjectType('MarketplaceShipmentTTNData')
export class MarketplaceShipmentTTNDataDTO {
  @Field(() => String, { description: 'ФИО экспедитора.' })
  expeditor_full_name!: string;
  @Field(() => String, { description: 'Контактный телефон экспедитора.' })
  expeditor_phone!: string;
  @Field(() => String, { description: 'Документ удостоверения личности (серия/номер).' })
  expeditor_id_doc!: string;
  @Field(() => String, { description: 'Госномер транспортного средства.' })
  vehicle_number!: string;
  @Field(() => String, { description: 'Адрес погрузки (склад поставщика).' })
  loading_address!: string;
  @Field(() => String, { description: 'Дата и время погрузки (ISO).' })
  loading_datetime!: string;
  @Field(() => String, { description: 'Расчётная дата и время доставки на КУ (ISO).' })
  delivery_datetime_estimate!: string;
}

@InputType('MarketplaceShipmentTTNDataInput')
export class MarketplaceShipmentTTNDataInputDTO {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  expeditor_full_name!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  expeditor_phone!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  expeditor_id_doc!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  vehicle_number!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  loading_address!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  loading_datetime!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  delivery_datetime_estimate!: string;
}

@ObjectType('MarketplaceShipment')
export class MarketplaceShipmentDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { description: 'Кооператив, в котором сформирована партия.' })
  coopname!: string;

  @Field(() => ID, { description: 'Идентификатор консолидированной заявки.' })
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
    description: 'Ссылка на запись document registry с подписанной ТТН.',
  })
  ttn_document_registry_id!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Локальная ссылка для скачивания и печати ТТН.',
  })
  ttn_pdf_url!: string | null;

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
  @Field(() => ID, { description: 'Идентификатор консолидированной заявки в статусе ACCEPTED.' })
  @IsString()
  @IsNotEmpty()
  cycle_id!: string;

  @Field(() => [MarketplaceShipmentGroupInputDTO], {
    description: 'Группы доставки — по одной на каждый КУ из заявки.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketplaceShipmentGroupInputDTO)
  groups!: MarketplaceShipmentGroupInputDTO[];
}

@ObjectType('MarketplaceCreateShipmentResult')
export class MarketplaceCreateShipmentResultDTO {
  @Field(() => [MarketplaceShipmentDTO], {
    description: 'Созданные партии — по одной на каждый КУ заявки.',
  })
  shipments!: MarketplaceShipmentDTO[];
}

@InputType('MarketplaceListShipmentsInput')
export class MarketplaceListShipmentsInputDTO {
  @Field(() => ID, { nullable: true, description: 'Фильтр по консолидированной заявке.' })
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
  dto.ttn_document_registry_id = e.ttn_document_registry_id;
  dto.ttn_pdf_url = e.ttn_pdf_url;
  dto.status = e.status as MarketplaceShipmentStatusEnum;
  dto.created_at = e.created_at;
  dto.updated_at = e.updated_at;
  return dto;
}

// Re-export raw enums (для использования в backend mapping).
export { MarketplaceShipmentDeliveryVariant, MarketplaceShipmentStatus };
