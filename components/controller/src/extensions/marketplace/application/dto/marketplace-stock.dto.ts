import { Field, Float, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import type { MarketplaceStockProposalDomainEntity } from '../../domain/entities/marketplace-stock-proposal.entity';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { DocumentAggregateDTO } from '~/application/document/dto/document-aggregate.dto';
import { MarketplaceUnitOfMeasureEnum } from './marketplace-offer.dto';
import { marketplaceOrderUnitLabel } from '../shared/unit-label.util';
import { MarketplaceConvertStatementSignedInputDTO } from '~/application/document/documents-dto/marketplace-convert-statement-document.dto';
import { MarketplaceIssueActSignedDocumentInputDTO } from '~/application/document/documents-dto/marketplace-issue-act-document.dto';

export enum MarketplaceStockProposalStatusEnum {
  PROPOSED = 'PROPOSED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED',
}

registerEnumType(MarketplaceStockProposalStatusEnum, {
  name: 'MarketplaceStockProposalStatus',
  description:
    'Состояние предложения имущества со склада кооператива: отправлено пайщику, принято, отклонено пайщиком либо отозвано оператором.',
});

@InputType('MarketplacePublishStockInput')
export class MarketplacePublishStockInputDTO {
  @Field(() => [String], { description: 'Позиции свободного остатка склада для публикации в каталог.' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  inventory_ids!: string[];

  @Field(() => String, {
    nullable: true,
    description:
      'Цена за единицу при публикации. Пусто — цена прибытия; меньше цены прибытия — уценка.',
  })
  @IsOptional()
  @IsString()
  price_per_unit?: string | null;

  @Field(() => Int, {
    nullable: true,
    description:
      'Срок гарантийного возврата в днях для этой публикации. Пусто — переносится срок исходного товара (обычно 0, если поставщик/модератор его не устанавливали).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  warranty_days?: number | null;
}

@InputType('MarketplaceUnpublishStockInput')
export class MarketplaceUnpublishStockInputDTO {
  @Field(() => [String], { description: 'Опубликованные позиции остатка, снимаемые с витрины.' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  inventory_ids!: string[];
}

@ObjectType('MarketplaceUnpublishStockResult')
export class MarketplaceUnpublishStockResultDTO {
  @Field(() => Int, { description: 'Сколько позиций снято с публикации.' })
  affected!: number;
}

@InputType('MarketplaceStockProposalItemInput')
export class MarketplaceStockProposalItemInputDTO {
  @Field(() => String, { description: 'Предложение кооператива из опубликованного остатка.' })
  @IsString()
  @IsNotEmpty()
  offer_id!: string;

  @Field(() => Float, {
    description:
      'Количество, предлагаемое пайщику: базовое количество при отпуске по мере, число упаковок — при отпуске упаковкой.',
  })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Выбранная упаковка каталога — только для товара с отпуском упаковкой.',
  })
  @IsOptional()
  @IsString()
  package_id?: string | null;
}

@InputType('MarketplaceStockIssuancePrepareInput')
export class MarketplaceStockIssuancePrepareInputDTO {
  @Field(() => String, { description: 'Кооперативный участок, со склада которого идёт докладка.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => String, { description: 'Пайщик-адресат докладки.' })
  @IsString()
  @IsNotEmpty()
  member_account!: string;

  @Field(() => [MarketplaceStockProposalItemInputDTO], {
    description: 'Корзина докладки: что и сколько предлагается со склада.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MarketplaceStockProposalItemInputDTO)
  items!: MarketplaceStockProposalItemInputDTO[];
}

@ObjectType('MarketplaceStockIssuanceOperatorLine')
export class MarketplaceStockIssuanceOperatorLineDTO {
  @Field(() => String, { description: 'Предложение кооператива из остатка.' })
  offer_id!: string;

  @Field(() => Float, {
    description: 'Количество: базовое при отпуске по мере, число упаковок — при отпуске упаковкой.',
  })
  quantity!: number;

  @Field(() => String, { description: 'Детерминированный order_hash будущего заказа из остатка.' })
  order_hash!: string;

  @Field(() => String, { description: 'Цена за единицу отпуска (за базовую единицу либо за упаковку).' })
  unit_price!: string;

  @Field(() => String, { description: 'Наименование товара.' })
  product_name!: string;

  @Field(() => String, { nullable: true, description: 'Выбранная упаковка каталога (пусто — отпуск по мере).' })
  package_id!: string | null;

  @Field(() => Float, { description: 'Содержимое упаковки в базовой единице (0 — отпуск по мере).' })
  package_size!: number;

  @Field(() => GeneratedDocumentDTO, {
    description: 'Акт приёма-передачи к подписи оператором КУ (первая подпись).',
  })
  signiss1_document!: GeneratedDocumentDTO;
}

@InputType('MarketplaceCreateStockProposalLineInput')
export class MarketplaceCreateStockProposalLineInputDTO {
  @Field(() => String, { description: 'Предложение кооператива из остатка.' })
  @IsString()
  @IsNotEmpty()
  offer_id!: string;

  @Field(() => Float, {
    description:
      'Количество, предлагаемое пайщику: базовое количество при отпуске по мере, число упаковок — при отпуске упаковкой.',
  })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Выбранная упаковка каталога (та же, что и в подготовке payloads) — только для отпуска упаковкой.',
  })
  @IsOptional()
  @IsString()
  package_id?: string | null;

  @Field(() => String, { description: 'order_hash из подготовки (marketplaceStockIssuancePayloads).' })
  @IsString()
  @IsNotEmpty()
  order_hash!: string;

  @Field(() => MarketplaceIssueActSignedDocumentInputDTO, {
    description: 'Акт приёма-передачи, подписанный оператором КУ первой подписью.',
  })
  @ValidateNested()
  @Type(() => MarketplaceIssueActSignedDocumentInputDTO)
  signiss1_act!: MarketplaceIssueActSignedDocumentInputDTO;
}

@InputType('MarketplaceCreateOrderProposalLineInput')
export class MarketplaceCreateOrderProposalLineInputDTO {
  @Field(() => String, { description: 'Существующий заказ пайщика к выдаче этим бандлом.' })
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @Field(() => Float, { description: 'Фактическое количество к выдаче (сверено оператором).' })
  @IsNumber()
  @Min(1)
  actual_quantity!: number;

  @Field(() => String, { description: 'Фактическая цена за единицу (оператор мог скорректировать).' })
  @IsString()
  @IsNotEmpty()
  actual_unit_price!: string;

  @Field(() => MarketplaceIssueActSignedDocumentInputDTO, {
    description: 'Акт приёма-передачи, подписанный оператором КУ первой подписью.',
  })
  @ValidateNested()
  @Type(() => MarketplaceIssueActSignedDocumentInputDTO)
  signiss1_act!: MarketplaceIssueActSignedDocumentInputDTO;
}

@InputType('MarketplaceCreateStockProposalInput')
export class MarketplaceCreateStockProposalInputDTO {
  @Field(() => String, { description: 'Кооперативный участок, со склада которого идёт выдача.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => String, { description: 'Пайщик-адресат бандла.' })
  @IsString()
  @IsNotEmpty()
  member_account!: string;

  @Field(() => [MarketplaceCreateStockProposalLineInputDTO], {
    nullable: true,
    description: 'Строки докладки со склада: order_hash и подпись оператора (signiss1).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketplaceCreateStockProposalLineInputDTO)
  items?: MarketplaceCreateStockProposalLineInputDTO[];

  @Field(() => [MarketplaceCreateOrderProposalLineInputDTO], {
    nullable: true,
    description: 'Строки уже существующих заказов пайщика к выдаче (подпись оператора signiss1).',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketplaceCreateOrderProposalLineInputDTO)
  order_items?: MarketplaceCreateOrderProposalLineInputDTO[];
}

@InputType('MarketplaceResolveStockProposalInput')
export class MarketplaceResolveStockProposalInputDTO {
  @Field(() => String, { description: 'Предложение со склада кооператива.' })
  @IsString()
  @IsNotEmpty()
  proposal_id!: string;
}

@ObjectType('MarketplaceStockAcceptOrderLine')
export class MarketplaceStockAcceptOrderLineDTO {
  @Field(() => String, { description: 'Идентификатор предложения позиции.' })
  public readonly offer_id!: string;

  @Field(() => String, { description: 'order_hash будущего заказа из остатка.' })
  public readonly order_hash!: string;

  @Field(() => DocumentAggregateDTO, {
    description:
      'Акт приёма-передачи, уже подписанный оператором КУ. Пайщик накладывает свою подпись поверх (получение).',
  })
  public readonly signiss1_aggregate!: DocumentAggregateDTO;
}

@ObjectType('MarketplaceStockAcceptPayload')
export class MarketplaceStockAcceptPayloadDTO {
  @Field(() => [MarketplaceStockAcceptOrderLineDTO], {
    description: 'Строки-заказы к созданию — вернуть их в принятии предложения.',
  })
  public readonly order_lines!: MarketplaceStockAcceptOrderLineDTO[];

  @Field(() => String, {
    description: 'Сколько спишется с уже внесённых членских средств «Стола заказов» (доплата с членского).',
  })
  public readonly member_amount!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Сумма доплаты с паевого через конвертацию. Пусто — членских средств хватает, доплаты с паевого нет.',
  })
  public readonly convert_amount?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Идентификатор Заявления о конвертации (для подписи).',
  })
  public readonly convert_hash?: string | null;

  @Field(() => GeneratedDocumentDTO, {
    nullable: true,
    description: 'Единое Заявление о конвертации к подписи. Пусто — подписывать нечего (доплаты нет).',
  })
  public readonly convert_document?: GeneratedDocumentDTO | null;
}

@InputType('MarketplaceStockFinalizeLineInput')
export class MarketplaceStockFinalizeLineInputDTO {
  @Field(() => String, { description: 'order_hash строки бандла (из payloads).' })
  @IsString()
  @IsNotEmpty()
  public readonly order_hash!: string;

  @Field(() => MarketplaceIssueActSignedDocumentInputDTO, {
    description: 'Акт приёма-передачи, контрподписанный пайщиком (подпись получения).',
  })
  @ValidateNested()
  @Type(() => MarketplaceIssueActSignedDocumentInputDTO)
  public readonly signed_signiss2_act!: MarketplaceIssueActSignedDocumentInputDTO;
}

@InputType('MarketplaceFinalizeStockIssuanceInput')
export class MarketplaceFinalizeStockIssuanceInputDTO extends MarketplaceResolveStockProposalInputDTO {
  @Field(() => [MarketplaceStockFinalizeLineInputDTO], {
    description: 'Строки докладки с подписью получения (signiss2) из marketplaceStockProposalSignablePayloads.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MarketplaceStockFinalizeLineInputDTO)
  public readonly order_lines!: MarketplaceStockFinalizeLineInputDTO[];

  @Field(() => MarketplaceConvertStatementSignedInputDTO, {
    nullable: true,
    description:
      'Единое подписанное Заявление о конвертации на всю сумму доплаты с паевого. Не передаётся, когда членских средств хватает.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MarketplaceConvertStatementSignedInputDTO)
  public readonly signed_convert?: MarketplaceConvertStatementSignedInputDTO | null;
}

@InputType('MarketplaceCancelStockOrderInput')
export class MarketplaceCancelStockOrderInputDTO {
  @Field(() => String, { description: 'Заказ со склада кооператива, отменяемый до открытия выдачи.' })
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @Field(() => String, { nullable: true, description: 'Причина отмены (видна пайщику в истории заказа).' })
  @IsOptional()
  @IsString()
  reason?: string | null;
}

@InputType('MarketplaceListStockProposalsInput')
export class MarketplaceListStockProposalsInputDTO {
  @Field(() => String, { nullable: true, description: 'Фильтр по кооперативному участку.' })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field(() => [MarketplaceStockProposalStatusEnum], {
    nullable: true,
    description: 'Фильтр по состояниям предложения.',
  })
  @IsOptional()
  @IsArray()
  statuses?: MarketplaceStockProposalStatusEnum[];
}

@ObjectType('MarketplaceStockProposalItem')
export class MarketplaceStockProposalItemDTO {
  @Field(() => String, { description: 'Предложение кооператива из остатка.' })
  offer_id!: string;

  @Field(() => Float, {
    description: 'Предложенное количество: базовое при отпуске по мере, число упаковок — при отпуске упаковкой.',
  })
  quantity!: number;

  @Field(() => String, { description: 'Цена за единицу отпуска на момент предложения.' })
  unit_price!: string;

  @Field(() => String, { description: 'Наименование товара.' })
  product_name!: string;

  @Field(() => MarketplaceUnitOfMeasureEnum, { nullable: true, description: 'Базовая единица измерения товара (штука, килограмм, литр).' })
  unit_of_measure!: MarketplaceUnitOfMeasureEnum | null;

  @Field(() => Float, { description: 'Содержимое упаковки в базовой единице (0 — отпуск по мере).' })
  package_size!: number;

  @Field(() => String, { nullable: true, description: 'Подпись единицы отпуска («упак. 0,5 л»), пусто — базовая единица.' })
  package_label!: string | null;
}

@ObjectType('MarketplaceStockProposal')
export class MarketplaceStockProposalDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String, { description: 'Кооперативный участок, со склада которого предложено имущество.' })
  braname!: string;

  @Field(() => String, { description: 'Пайщик-адресат предложения.' })
  member_account!: string;

  @Field(() => String, { description: 'Оператор, сформировавший предложение.' })
  operator_account!: string;

  @Field(() => [MarketplaceStockProposalItemDTO], { description: 'Строки предложения.' })
  items!: MarketplaceStockProposalItemDTO[];

  @Field(() => MarketplaceStockProposalStatusEnum)
  status!: MarketplaceStockProposalStatusEnum;

  @Field(() => String, { description: 'Итоговая сумма предложения.' })
  total_cost!: string;

  @Field(() => [String], { description: 'Заказы, созданные при принятии предложения.' })
  created_order_ids!: string[];

  @Field(() => Date, { nullable: true, description: 'Момент решения по предложению.' })
  resolved_at!: Date | null;

  @Field(() => Date)
  created_at!: Date;
}

@ObjectType('MarketplaceStockProposalAcceptResult')
export class MarketplaceStockProposalAcceptResultDTO {
  @Field(() => MarketplaceStockProposalDTO)
  proposal!: MarketplaceStockProposalDTO;

  @Field(() => [String], { description: 'Созданные заказы со склада кооператива.' })
  order_ids!: string[];
}

export function toMarketplaceStockProposalDTO(
  e: MarketplaceStockProposalDomainEntity
): MarketplaceStockProposalDTO {
  const dto = new MarketplaceStockProposalDTO();
  dto.id = e.id;
  dto.braname = e.braname;
  dto.member_account = e.member_account;
  dto.operator_account = e.operator_account;
  dto.items = e.items.map((i) => {
    const item = new MarketplaceStockProposalItemDTO();
    item.offer_id = i.offer_id;
    item.quantity = i.quantity;
    item.unit_price = i.unit_price;
    item.product_name = i.product_name;
    item.unit_of_measure = i.unit_of_measure ?? null;
    item.package_size = i.package_size ?? 0;
    item.package_label =
      i.package_size && i.unit_of_measure
        ? `упак. ${String(i.package_size).replace('.', ',')} ${marketplaceOrderUnitLabel(i.unit_of_measure)}`
        : null;
    return item;
  });
  dto.status = e.status as MarketplaceStockProposalStatusEnum;
  dto.total_cost = e.total_cost.toFixed(4);
  dto.created_order_ids = e.created_order_ids;
  dto.resolved_at = e.resolved_at;
  dto.created_at = e.created_at;
  return dto;
}
