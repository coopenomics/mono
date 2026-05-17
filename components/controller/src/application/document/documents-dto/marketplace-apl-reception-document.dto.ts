import { InputType, Field, Int, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import type { ExcludeCommonProps } from '~/application/document/types';

type action = Cooperative.Registry.MarketplaceAplReception.Action;

@InputType('BaseMarketplaceAplReceptionMetaDocumentInput')
class BaseMarketplaceAplReceptionMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Идентификатор Order\'а, к которому относится акт приёмки.' })
  @IsString()
  order_id!: string;

  @Field({ description: 'Канонический хэш Order\'а в блокчейне.' })
  @IsString()
  order_hash!: string;

  @Field({ description: 'Имя кооперативного участка-приёмника партии.' })
  @IsString()
  accept_braname!: string;

  @Field({ description: 'Идентификатор записи акта приёмки.' })
  @IsString()
  reception_id!: string;

  @Field(() => Int, { description: 'Фактически принятое количество единиц.' })
  @IsInt()
  @Min(0)
  fact_quantity!: number;

  @Field({ description: 'Сумма по Order\'у с учётом фактического количества.' })
  @IsString()
  total_amount!: string;

  @Field({ description: 'Account поставщика — отправителя партии.' })
  @IsString()
  supplier_account!: string;

  @Field({ description: 'Номер акта приёмки для шапки документа.' })
  @IsString()
  act_id!: string;

  @Field({
    description: 'Account поставщика — отправителя партии (строка «Передал заказ» в акте).',
  })
  @IsString()
  transmitter!: string;

  @Field({
    nullable: true,
    description: 'Имя кооперативного участка-приёмника для ветки «филиал» в шаблоне акта.',
  })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field({
    nullable: true,
    description: 'Account председателя — подписанта закрывающей подписи (если уже известен).',
  })
  @IsOptional()
  @IsString()
  chairman_account?: string;

  @Field({
    description:
      'Флаг пропуска сохранения документа (preview-режим для отображения пользователю перед подписью).',
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
    description: 'Метаданные подписанного акта приёмки — содержат order_id, order_hash, КУ-приёмник и фактическое количество.',
  })
  public readonly meta!: MarketplaceAplReceptionSignedMetaDocumentInputDTO;
}
