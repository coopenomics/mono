import { Field, Float, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ArrayMinSize, IsArray, IsNumber, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { MarketplaceAplReceptionDomainEntity } from '../../domain/entities/marketplace-apl-reception.entity';
import { MarketplaceAplReceptionSignedDocumentInputDTO } from '~/application/document/documents-dto/marketplace-apl-reception-document.dto';
import { MarketplaceShipmentTTNDataDTO } from './marketplace-shipment.dto';

export enum MarketplaceAplReceptionVariantEnum {
  IN_PERSON = 'A',
  EXPEDITOR = 'B',
}

registerEnumType(MarketplaceAplReceptionVariantEnum, {
  name: 'MarketplaceAplReceptionVariant',
  description: 'Вариант приёмки: A — поставщик лично, B — экспедитор с асинхронной подписью.',
});

export enum MarketplaceAplReceptionStatusEnum {
  PENDING_SUPPLIER_SIGN = 'PENDING_SUPPLIER_SIGN',
  PENDING_CHAIRMAN_RECEPTION_SIGN = 'PENDING_CHAIRMAN_RECEPTION_SIGN',
  ACCEPTED_TO_COOP = 'ACCEPTED_TO_COOP',
  CANCELLED = 'CANCELLED',
}

registerEnumType(MarketplaceAplReceptionStatusEnum, {
  name: 'MarketplaceAplReceptionStatus',
  description: 'Статус АПП приёмки на КУ.',
});

@ObjectType('MarketplaceAplReceptionFactEntry')
export class MarketplaceAplReceptionFactEntryDTO {
  @Field(() => String)
  order_id!: string;

  @Field(() => Float, { description: 'Фактически принятое количество (для расхождений Варианта Б).' })
  fact_quantity!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Фактическая цена за единицу (если оператор скорректировал её при открытии приёмки).',
  })
  fact_unit_price!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Наименование товара по этой позиции — для таблицы сверки в диалоге подписи.',
  })
  product_name!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Базовая единица измерения товара по этой позиции (штука, килограмм, литр).',
  })
  unit_of_measure!: string | null;

}

@InputType('MarketplaceAplReceptionFactEntryInput')
export class MarketplaceAplReceptionFactEntryInputDTO {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  fact_quantity!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Фактическая цена за единицу (оператор может изменить её при открытии приёмки).',
  })
  @IsOptional()
  @IsString()
  fact_unit_price?: string;
}

@ObjectType('MarketplaceAplReception')
export class MarketplaceAplReceptionDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  coopname!: string;

  @Field(() => String, { description: 'Партия поставки, по которой формируется приёмка.' })
  shipment_id!: string;

  @Field(() => String, { description: 'Консолидированная заявка.' })
  cycle_id!: string;

  @Field(() => String, { description: 'КУ-получатель партии.' })
  braname!: string;

  @Field(() => String, { description: 'Account поставщика-владельца Offer\'ов.' })
  offerer_account!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Наименование поставщика (ФИО или название организации) — для экранов приёмки/подписи.',
  })
  offerer_name!: string | null;

  @Field(() => MarketplaceAplReceptionVariantEnum)
  variant!: MarketplaceAplReceptionVariantEnum;

  @Field(() => MarketplaceAplReceptionStatusEnum)
  status!: MarketplaceAplReceptionStatusEnum;

  @Field(() => [MarketplaceAplReceptionFactEntryDTO], {
    description: 'Фактически принятое количество per-Order.',
  })
  fact_quantity_per_order!: MarketplaceAplReceptionFactEntryDTO[];

  @Field(() => String, { nullable: true, description: 'Номер ТТН (только для Варианта Б).' })
  ttn_number!: string | null;

  @Field(() => MarketplaceShipmentTTNDataDTO, {
    nullable: true,
    description: 'Снапшот данных экспедитора + ТТН (только для Варианта Б).',
  })
  expeditor_data!: MarketplaceShipmentTTNDataDTO | null;

  @Field(() => String)
  created_by_operator_account!: string;

  @Field(() => Date, { nullable: true })
  supplier_signed_at!: Date | null;

  @Field(() => String, { nullable: true, description: 'Хэш транзакции подписи поставщика.' })
  supplier_signsupp_tx_hash!: string | null;

  @Field(() => Date, { nullable: true })
  chairman_signed_at!: Date | null;

  @Field(() => String, { nullable: true, description: 'Account председателя, поставившего закрывающую подпись.' })
  chairman_account!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Хэш транзакции закрывающей подписи председателя.',
  })
  chairman_signchair_tx_hash!: string | null;

  @Field(() => String, { description: 'Сумма АПП (с учётом расхождений Варианта Б).' })
  total_amount!: string;

  @Field(() => Date)
  created_at!: Date;

  @Field(() => Date)
  updated_at!: Date;
}

@InputType('MarketplaceCreateAplReceptionInput')
export class MarketplaceCreateAplReceptionInputDTO {
  @Field(() => String, { description: 'Партия поставки в статусе SUPPLY_PREPARED.' })
  @IsString()
  @IsNotEmpty()
  shipment_id!: string;

  @Field(() => [MarketplaceAplReceptionFactEntryInputDTO], {
    nullable: true,
    description:
      'Опционально для Варианта Б — фактически принятое количество per-Order. Для пропущенных Order\'ов берётся order.quantity.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketplaceAplReceptionFactEntryInputDTO)
  fact_quantity_per_order?: MarketplaceAplReceptionFactEntryInputDTO[];
}

@InputType('MarketplaceSignAplReceptionInput')
export class MarketplaceSignAplReceptionInputDTO {
  @Field(() => String, { description: 'Идентификатор акта приёмки.' })
  @IsString()
  @IsNotEmpty()
  apl_reception_id!: string;

  @Field(() => [MarketplaceAplReceptionSignedDocumentInputDTO], {
    description:
      'Подписанные клиентом акты приёмки — один документ на каждый Order группы. Backend верифицирует подпись и отправляет on-chain signsupp/signchair с этим документом.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarketplaceAplReceptionSignedDocumentInputDTO)
  signed_documents!: MarketplaceAplReceptionSignedDocumentInputDTO[];
}

@InputType('MarketplaceAplReceptionByIdInput')
export class MarketplaceAplReceptionByIdInputDTO {
  @Field(() => String, { description: 'Идентификатор акта приёмки.' })
  @IsString()
  @IsNotEmpty()
  apl_reception_id!: string;
}

@InputType('MarketplaceListAplReceptionsByBranameInput')
export class MarketplaceListAplReceptionsByBranameInputDTO {
  @Field(() => String, { description: 'Идентификатор КУ-получателя.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;
}

@ObjectType('MarketplaceAplReceptionResult')
export class MarketplaceAplReceptionResultDTO {
  @Field(() => MarketplaceAplReceptionDTO)
  apl_reception!: MarketplaceAplReceptionDTO;
}

@InputType('MarketplaceListSupplierPickupOrdersInput')
export class MarketplaceListSupplierPickupOrdersInputDTO {
  @Field(() => String, { description: 'КУ, на котором оператор принимает имущество.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => String, { description: 'Поставщик, чьё имущество принимается на этом КУ.' })
  @IsString()
  @IsNotEmpty()
  offerer_account!: string;
}

@InputType('MarketplaceCreateExpressReceptionInput')
export class MarketplaceCreateExpressReceptionInputDTO {
  @Field(() => String, { description: 'Поставщик, приехавший на ПВЗ для самовывоза.' })
  @IsString()
  @IsNotEmpty()
  offerer_account!: string;

  @Field(() => String, { description: 'КУ, на котором оператор принимает имущество.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => [MarketplaceAplReceptionFactEntryInputDTO], {
    nullable: true,
    description:
      'Фактически принятое количество и цена per-Order — оператор корректирует их при открытии приёмки. Для пропущенных Order\'ов берётся order.quantity и цена заказа.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketplaceAplReceptionFactEntryInputDTO)
  fact_quantity_per_order?: MarketplaceAplReceptionFactEntryInputDTO[];
}

@ObjectType('MarketplaceExpressPickupCandidate')
export class MarketplaceExpressPickupCandidateDTO {
  @Field(() => String, { description: 'Поставщик с принятыми заказами, ожидающими самовывоза на этом КУ.' })
  offerer_account!: string;

  @Field(() => String, { description: 'КУ-получатель.' })
  braname!: string;

  @Field(() => Int, { description: 'Сколько принятых заказов ожидает приёмки.' })
  orders_count!: number;

  @Field(() => Float, { description: 'Суммарное количество единиц.' })
  total_units!: number;

  @Field(() => String, { description: 'Суммарная сумма заказов.' })
  total_amount!: string;
}

@ObjectType('MarketplaceCreateExpressReceptionResult')
export class MarketplaceCreateExpressReceptionResultDTO {
  @Field(() => [MarketplaceAplReceptionDTO], {
    description: 'Сформированные акты приёмки (по одному на заявку поставщика на этом КУ).',
  })
  apl_receptions!: MarketplaceAplReceptionDTO[];
}

export function toExpressPickupCandidateDTO(c: {
  offerer_account: string;
  braname: string;
  orders_count: number;
  total_units: number;
  total_amount: string;
}): MarketplaceExpressPickupCandidateDTO {
  const dto = new MarketplaceExpressPickupCandidateDTO();
  dto.offerer_account = c.offerer_account;
  dto.braname = c.braname;
  dto.orders_count = c.orders_count;
  dto.total_units = c.total_units;
  dto.total_amount = c.total_amount;
  return dto;
}

/**
 * Отображаемые реквизиты приёмки, которыми резолвер обогащает АПП для экранов
 * подписи/сверки: наименование поставщика и наименования товаров по позициям.
 * Резолвятся в уже авторизованных (оператор/председатель КУ или сам поставщик)
 * списочных методах; на самой сущности не хранятся (ссылки по аккаунту/order_id).
 */
export interface MarketplaceAplReceptionDisplayFields {
  offerer_name?: string | null;
  lineByOrderId?: Map<
    string,
    { product_name: string | null; unit_of_measure: string | null }
  >;
}

export function toMarketplaceAplReceptionDTO(
  e: MarketplaceAplReceptionDomainEntity,
  display?: MarketplaceAplReceptionDisplayFields
): MarketplaceAplReceptionDTO {
  const dto = new MarketplaceAplReceptionDTO();
  dto.id = e.id;
  dto.coopname = e.coopname;
  dto.shipment_id = e.shipment_id;
  dto.cycle_id = e.cycle_id;
  dto.braname = e.braname;
  dto.offerer_account = e.offerer_account;
  dto.offerer_name = display?.offerer_name ?? null;
  dto.variant = e.variant as MarketplaceAplReceptionVariantEnum;
  dto.status = e.status as MarketplaceAplReceptionStatusEnum;
  dto.fact_quantity_per_order = e.fact_quantity_per_order.map((f) => {
    const entry = new MarketplaceAplReceptionFactEntryDTO();
    entry.order_id = f.order_id;
    entry.fact_quantity = f.fact_quantity;
    entry.fact_unit_price = f.fact_unit_price ?? null;
    const line = display?.lineByOrderId?.get(f.order_id);
    entry.product_name = line?.product_name ?? null;
    entry.unit_of_measure = line?.unit_of_measure ?? null;
    return entry;
  });
  dto.ttn_number = e.ttn_number;
  dto.expeditor_data = e.expeditor_data
    ? Object.assign(new MarketplaceShipmentTTNDataDTO(), e.expeditor_data)
    : null;
  dto.created_by_operator_account = e.created_by_operator_account;
  dto.supplier_signed_at = e.supplier_signed_at;
  dto.supplier_signsupp_tx_hash = e.supplier_signsupp_tx_hash;
  dto.chairman_signed_at = e.chairman_signed_at;
  dto.chairman_account = e.chairman_account;
  dto.chairman_signchair_tx_hash = e.chairman_signchair_tx_hash;
  dto.total_amount = e.total_amount;
  dto.created_at = e.created_at;
  dto.updated_at = e.updated_at;
  return dto;
}
