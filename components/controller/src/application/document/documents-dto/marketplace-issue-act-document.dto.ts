import { Field, InputType, Int, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import type { ExcludeCommonProps } from '~/application/document/types';

/**
 * Story 6.1 / 6.3: подписываемая форма акта приёмки-передачи имущества
 * (АПП-выдачи) пайщику на ПВЗ. Использует тот же шаблон документа, что и
 * АПП приёмки (registry_id=1102 «Акт приёмки-передачи имущества»), но в
 * другой ролевой раскладке:
 *
 *   - `username` (из IGenerate, дано factory) — пайщик-получатель имущества;
 *   - `transmitter` — учётная запись передающей стороны от кооператива:
 *     председатель КУ выдачи или доверенное им лицо (для `signiss1`
 *     передающая сторона — председатель КУ; для `signiss2` подпись ставят
 *     `delivery_signer` и заказчик).
 */
type action = Cooperative.Registry.MarketplaceAplReception.Action;

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

  @Field(() => Int, { description: 'Фактически принятое количество единиц по заказу.' })
  @IsInt()
  @Min(0)
  fact_quantity!: number;

  @Field({ description: 'Сумма по заказу с учётом фактического количества.' })
  @IsString()
  total_amount!: string;

  @Field({ description: 'Учётная запись поставщика, передавшего партию на кооперативный участок.' })
  @IsString()
  supplier_account!: string;

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

  @Field(() => Int, {
    nullable: true,
    description: 'Фактически выдаваемое количество единиц (заполняется на финальной подписи).',
  })
  @IsOptional()
  @IsInt()
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
