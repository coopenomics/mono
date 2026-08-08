import { Field, Float, InputType, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import type { ExcludeCommonProps } from '~/application/document/types';

/**
 * Story 6.1 / 6.3: подписываемая форма акта выдачи имущества пайщику на ПВЗ
 * (кооператив → заказчик). Отдельный реестр документов
 * `1105.MarketplaceAplIssuance` — НЕ путать с АПП приёмки от поставщика
 * (`1104.MarketplaceAplReception`). Ролевая раскладка:
 *
 *   - `username` (из IGenerate, дано factory) — пайщик-получатель имущества;
 *   - `transmitter` — оператор КУ выдачи (председатель или доверенное им лицо),
 *     передающая сторона от кооператива, «Выдал» (для `signiss1` подпись ставит
 *     оператор КУ; для `signiss2` — `delivery_signer` и заказчик).
 */
type action = Cooperative.Registry.MarketplaceAplIssuance.Action;

@InputType('BaseMarketplaceIssueActMetaDocumentInput')
class BaseMarketplaceIssueActMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Идентификатор заказа пайщика, по которому формируется акт выдачи.' })
  @IsString()
  order_id!: string;

  @Field({ description: 'Канонический хэш заказа в блокчейне.' })
  @IsString()
  order_hash!: string;

  @Field({ description: 'Имя приёмного кооперативного участка, на который передаётся партия.' })
  @IsString()
  accept_braname!: string;

  @Field({ description: 'Идентификатор записи акта приёмки в инфраструктуре marketplace.' })
  @IsString()
  reception_id!: string;

  @Field(() => Float, { description: 'Фактически принятое количество единиц по заказу.' })
  @IsNumber()
  @Min(0)
  fact_quantity!: number;

  @Field({ description: 'Сумма по заказу с учётом фактического количества.' })
  @IsString()
  total_amount!: string;

  @Field({ description: 'Учётная запись поставщика, передавшего партию на кооперативный участок.' })
  @IsString()
  supplier_account!: string;

  @Field({ description: 'Артикул (СКУ) товара по заказу.' })
  @IsString()
  sku!: string;

  @Field({ description: 'Наименование товара по заказу.' })
  @IsString()
  product_title!: string;

  @Field({ description: 'Единица измерения товара (человекочитаемая).' })
  @IsString()
  unit_of_measurement!: string;

  @Field({ description: 'Цена за единицу товара по заказу.' })
  @IsString()
  unit_cost!: string;

  @Field({ description: 'Символ валюты для сумм в акте.' })
  @IsString()
  currency!: string;

  @Field({ description: 'Номер акта для шапки документа.' })
  @IsString()
  act_id!: string;

  @Field({
    description: 'Учётная запись передающей стороны — председатель кооперативного участка или доверенное им лицо.',
  })
  @IsString()
  transmitter!: string;

  @Field({
    nullable: true,
    description: 'Имя кооперативного участка, выдающего имущество пайщику.',
  })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field(() => Float, {
    nullable: true,
    description: 'Фактически выдаваемое количество единиц (заполняется на финальной подписи).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actual_quantity?: number;

  @Field({
    nullable: true,
    description: 'Хэш приватного payload документа (если приватные данные хранятся отдельно).',
  })
  @IsOptional()
  @IsString()
  doc_data_hash?: string;

  @Field({
    description: 'Сформировать документ без сохранения (preview-режим).',
  })
  @IsBoolean()
  skip_save!: boolean;
}

@InputType('MarketplaceIssueActGenerateDocumentInput')
export class MarketplaceIssueActGenerateDocumentInputDTO
  extends IntersectionType(
    BaseMarketplaceIssueActMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType('MarketplaceIssueActSignedMetaDocumentInput')
export class MarketplaceIssueActSignedMetaDocumentInputDTO
  extends IntersectionType(BaseMarketplaceIssueActMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType('MarketplaceIssueActSignedDocumentInput')
export class MarketplaceIssueActSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => MarketplaceIssueActSignedMetaDocumentInputDTO, {
    description: 'Метаданные подписанного акта выдачи имущества.',
  })
  public readonly meta!: MarketplaceIssueActSignedMetaDocumentInputDTO;
}
