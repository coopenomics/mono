import { Field, Float, InputType, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

type action = Cooperative.Registry.MarketplaceAplReception.Action;

@InputType('BaseMarketplaceAplReceptionMetaDocumentInput')
class BaseMarketplaceAplReceptionMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Идентификатор заказа пайщика, по которому формируется акт.' })
  @IsString()
  order_id!: string;

  @Field({ description: 'Канонический хэш заказа в блокчейне.' })
  @IsString()
  order_hash!: string;

  @Field({ description: 'Имя кооперативного участка, выдающего имущество пайщику.' })
  @IsString()
  accept_braname!: string;

  @Field({ description: 'Идентификатор записи акта в реестре marketplace.' })
  @IsString()
  reception_id!: string;

  @Field(() => Float, { description: 'Фактически принятое количество единиц.' })
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
    description: 'Имя кооперативного участка, выдающего имущество.',
  })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field({
    nullable: true,
    description: 'Учётная запись председателя — подписанта закрывающей подписи (если уже известен).',
  })
  @IsOptional()
  @IsString()
  chairman_account?: string;

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

@InputType('MarketplaceAplReceptionGenerateDocumentInput')
export class MarketplaceAplReceptionGenerateDocumentInputDTO
  extends IntersectionType(
    BaseMarketplaceAplReceptionMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType('MarketplaceAplReceptionSignedMetaDocumentInput')
export class MarketplaceAplReceptionSignedMetaDocumentInputDTO
  extends IntersectionType(BaseMarketplaceAplReceptionMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType('MarketplaceAplReceptionSignedDocumentInput')
export class MarketplaceAplReceptionSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => MarketplaceAplReceptionSignedMetaDocumentInputDTO, {
    description: 'Метаданные подписанного акта приёмки-передачи имущества.',
  })
  public readonly meta!: MarketplaceAplReceptionSignedMetaDocumentInputDTO;
}
