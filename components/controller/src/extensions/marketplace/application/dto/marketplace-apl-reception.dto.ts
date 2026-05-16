import { Field, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { MarketplaceAplReceptionDomainEntity } from '../../domain/entities/marketplace-apl-reception.entity';
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
  @Field(() => ID)
  order_id!: string;

  @Field(() => Int, { description: 'Фактически принятое количество (для расхождений Варианта Б).' })
  fact_quantity!: number;
}

@InputType('MarketplaceAplReceptionFactEntryInput')
export class MarketplaceAplReceptionFactEntryInputDTO {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  fact_quantity!: number;
}

@ObjectType('MarketplaceAplReception')
export class MarketplaceAplReceptionDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  coopname!: string;

  @Field(() => ID, { description: 'Партия поставки, по которой формируется приёмка.' })
  shipment_id!: string;

  @Field(() => ID, { description: 'Консолидированная заявка.' })
  cycle_id!: string;

  @Field(() => String, { description: 'КУ-получатель партии.' })
  ku_id!: string;

  @Field(() => String, { description: 'Account поставщика-владельца Offer\'ов.' })
  offerer_account!: string;

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
  @Field(() => ID, { description: 'Партия поставки в статусе SUPPLY_PREPARED.' })
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

@InputType('MarketplaceSignatureInfoInput')
export class MarketplaceSignatureInfoInputDTO {
  @Field(() => String, { description: 'Account-имя подписанта (EOS-account).' })
  @IsString()
  signer!: string;

  @Field(() => String, { description: 'Публичный ключ подписанта (EOS_K1_...).' })
  @IsString()
  public_key!: string;

  @Field(() => String, { description: 'Подпись (EOS_K1_SIG_...).' })
  @IsString()
  signature!: string;
}

@InputType('MarketplaceSignedDocumentInput')
export class MarketplaceSignedDocumentInputDTO {
  @Field(() => String) @IsString() version!: string;
  @Field(() => String, { description: 'hash подписного документа.' }) @IsString() hash!: string;
  @Field(() => String) @IsString() doc_hash!: string;
  @Field(() => String) @IsString() meta_hash!: string;
  @Field(() => String, { description: 'Сериализованный JSON.stringify(meta).' })
  @IsString()
  meta!: string;
  @Field(() => [MarketplaceSignatureInfoInputDTO])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketplaceSignatureInfoInputDTO)
  signatures!: MarketplaceSignatureInfoInputDTO[];
}

@InputType('MarketplaceAplReceptionSignedOrderInput')
export class MarketplaceAplReceptionSignedOrderInputDTO {
  @Field(() => ID, { description: 'Order, к которому относится подписанный документ.' })
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @Field(() => MarketplaceSignedDocumentInputDTO, {
    description: 'Подписанный клиентом Document2 — отправляется в on-chain signsupp/signchair.',
  })
  @ValidateNested()
  @Type(() => MarketplaceSignedDocumentInputDTO)
  signed_document!: MarketplaceSignedDocumentInputDTO;
}

@InputType('MarketplaceSignAplReceptionInput')
export class MarketplaceSignAplReceptionInputDTO {
  @Field(() => ID, { description: 'Идентификатор АПП приёмки.' })
  @IsString()
  @IsNotEmpty()
  apl_reception_id!: string;

  @Field(() => [MarketplaceAplReceptionSignedOrderInputDTO], {
    nullable: true,
    description:
      'Подписанные клиентом Document2 per-Order. Если передан — backend отправляет on-chain signsupp/signchair с реальными подписями и сохраняет реальный tx_hash. Если не передан — сохраняется placeholder tx_hash (backwards-compat для UI без FR45 обвязки).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketplaceAplReceptionSignedOrderInputDTO)
  signed_documents?: MarketplaceAplReceptionSignedOrderInputDTO[];
}

/**
 * Story 598-15 / FR45: payload подписи per-Order для клиента.
 * Клиент получает массив, подписывает каждый `hash` приватным ключом
 * и возвращает результат в `marketplaceSignAplReceptionAsSupplier`.
 */
@ObjectType('MarketplaceAplReceptionSignablePayload')
export class MarketplaceAplReceptionSignablePayloadDTO {
  @Field(() => ID) order_id!: string;
  @Field(() => String) order_hash!: string;
  @Field(() => String) version!: string;
  @Field(() => String, { description: 'JSON-сериализованные мета-поля акта.' })
  meta!: string;
  @Field(() => String) meta_hash!: string;
  @Field(() => String) doc_hash!: string;
  @Field(() => String, { description: 'Digest для клиентской подписи.' })
  hash!: string;
}

@ObjectType('MarketplaceAplReceptionResult')
export class MarketplaceAplReceptionResultDTO {
  @Field(() => MarketplaceAplReceptionDTO)
  apl_reception!: MarketplaceAplReceptionDTO;
}

export function toMarketplaceAplReceptionDTO(
  e: MarketplaceAplReceptionDomainEntity
): MarketplaceAplReceptionDTO {
  const dto = new MarketplaceAplReceptionDTO();
  dto.id = e.id;
  dto.coopname = e.coopname;
  dto.shipment_id = e.shipment_id;
  dto.cycle_id = e.cycle_id;
  dto.ku_id = e.ku_id;
  dto.offerer_account = e.offerer_account;
  dto.variant = e.variant as MarketplaceAplReceptionVariantEnum;
  dto.status = e.status as MarketplaceAplReceptionStatusEnum;
  dto.fact_quantity_per_order = e.fact_quantity_per_order.map((f) => {
    const entry = new MarketplaceAplReceptionFactEntryDTO();
    entry.order_id = f.order_id;
    entry.fact_quantity = f.fact_quantity;
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
