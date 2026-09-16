import { Field, Float, InputType, Int, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsNumber, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Cooperative } from 'cooptypes';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

/**
 * Подписываемая форма Заявления оператора кооперативного участка в совет об
 * отмене сделки по гарантийному возврату имущества (registry_id=1116,
 * `MarketplaceReturnCancelStatement`). Оператор осмотрел и принял имущество
 * по рекламации пайщика (1106) и просит совет отменить сделку по заказу и
 * восстановить пайщику паевой и членский взносы за принятое. Подписывает
 * только оператор у стойки (`accretrn`); документ уходит в повестку совета,
 * робот берёт из его метаданных деловые поля протокола 1117.
 */
type action = Cooperative.Registry.MarketplaceReturnCancelStatement.Action;

@InputType('BaseMarketplaceReturnCancelStatementMetaDocumentInput')
class BaseMarketplaceReturnCancelStatementMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Идентификатор заказа, сделка по которому отменяется.' })
  @IsString()
  order_id!: string;

  @Field({ description: 'Канонический order_hash отменяемой сделки.' })
  @IsString()
  order_hash!: string;

  @Field({ description: 'Хэш рекламации пайщика (заявления на возврат).' })
  @IsString()
  request_hash!: string;

  @Field({ description: 'Кооперативный участок, на котором принято имущество.' })
  @IsString()
  braname!: string;

  @Field({ description: 'Пайщик-заказчик, чья сделка отменяется.' })
  @IsString()
  orderer!: string;

  @Field({ description: 'Оператор участка, принявший имущество.' })
  @IsString()
  operator!: string;

  @Field(() => Int, { description: 'Номер протокола решения совета о выдаче имущества по заказу; 0 — без протокола.' })
  @IsInt()
  @Min(0)
  issue_decision_id!: number;

  @Field({ description: 'Артикул (SKU) товара — идентификатор предложения исходного заказа.' })
  @IsString()
  sku!: string;

  @Field({ description: 'Наименование товара из предложения.' })
  @IsString()
  product_title!: string;

  @Field({ description: 'Единица измерения (например «литры», «кг», «шт.»).' })
  @IsString()
  unit_of_measurement!: string;

  @Field(() => Float, { description: 'Принятое на участке количество единиц.' })
  @IsNumber()
  @Min(1)
  actual_quantity!: number;

  @Field({ description: 'Стоимость базовой единицы товара (4 знака после запятой).' })
  @IsString()
  unit_cost!: string;

  @Field({ description: 'Стоимость принятого имущества — паевой взнос к восстановлению (4 знака после запятой).' })
  @IsString()
  fact_cost!: string;

  @Field({ description: 'Членский взнос за принятое имущество — к восстановлению (4 знака после запятой).' })
  @IsString()
  fee_refund!: string;

  @Field({ description: 'Всего к восстановлению пайщику (4 знака после запятой).' })
  @IsString()
  total_refund!: string;

  @Field({ description: 'Код валюты расчёта (например «RUB»).' })
  @IsString()
  currency!: string;

  @Field({ description: 'Причина обращения пайщика из рекламации.' })
  @IsString()
  reason_text!: string;

  @Field({ description: 'Результат осмотра имущества оператором на участке.' })
  @IsString()
  inspection_result!: string;

  @Field({
    description: 'Сформировать документ без сохранения (preview-режим).',
  })
  @IsBoolean()
  skip_save!: boolean;
}

@InputType('MarketplaceReturnCancelStatementGenerateDocumentInput')
export class MarketplaceReturnCancelStatementGenerateDocumentInputDTO
  extends IntersectionType(
    BaseMarketplaceReturnCancelStatementMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType('MarketplaceReturnCancelStatementSignedMetaDocumentInput')
export class MarketplaceReturnCancelStatementSignedMetaDocumentInputDTO
  extends IntersectionType(BaseMarketplaceReturnCancelStatementMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType('MarketplaceReturnCancelStatementSignedInput')
export class MarketplaceReturnCancelStatementSignedInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => MarketplaceReturnCancelStatementSignedMetaDocumentInputDTO, {
    description: 'Метаданные подписанного заявления оператора об отмене сделки по гарантийному возврату.',
  })
  @ValidateNested()
  @Type(() => MarketplaceReturnCancelStatementSignedMetaDocumentInputDTO)
  public readonly meta!: MarketplaceReturnCancelStatementSignedMetaDocumentInputDTO;
}
