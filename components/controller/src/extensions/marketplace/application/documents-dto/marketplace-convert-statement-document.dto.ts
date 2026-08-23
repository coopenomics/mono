import { Field, InputType, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsBoolean, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Cooperative } from 'cooptypes';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

/**
 * Подписываемая форма заявления пайщика о конвертации паевого взноса в
 * членский взнос по ЦПП «Стол заказов» (registry_id=1110,
 * `MarketplaceConvertStatement`).
 *
 * Генерируется на оформлении заказа по одному на каждый Order (сумма =
 * стоимость заказа + членский взнос) и уходит on-chain параметром
 * `convert_statement` действий `marketplace::createorder` /
 * `marketplace::stockorder`; контракт публикует его в реестр документов
 * самостоятельным пакетом (package = hash заявления).
 */
type action = Cooperative.Registry.MarketplaceConvertStatement.Action;

@InputType('BaseMarketplaceConvertStatementMetaDocumentInput')
class BaseMarketplaceConvertStatementMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Канонический order_hash заказа, под который конвертируется взнос.' })
  @IsString()
  order_hash!: string;

  @Field({ description: 'Сумма конвертации (стоимость заказа + членский взнос), с валютой.' })
  @IsString()
  amount!: string;

  @Field({
    description: 'Сформировать документ без сохранения (preview-режим).',
  })
  @IsBoolean()
  skip_save!: boolean;
}

@InputType('MarketplaceConvertStatementGenerateDocumentInput')
export class MarketplaceConvertStatementGenerateDocumentInputDTO
  extends IntersectionType(
    BaseMarketplaceConvertStatementMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType('MarketplaceConvertStatementSignedMetaDocumentInput')
export class MarketplaceConvertStatementSignedMetaDocumentInputDTO
  extends IntersectionType(BaseMarketplaceConvertStatementMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType('MarketplaceConvertStatementSignedInput')
export class MarketplaceConvertStatementSignedInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => MarketplaceConvertStatementSignedMetaDocumentInputDTO, {
    description: 'Метаданные подписанного заявления о конвертации паевого взноса.',
  })
  @ValidateNested()
  @Type(() => MarketplaceConvertStatementSignedMetaDocumentInputDTO)
  public readonly meta!: MarketplaceConvertStatementSignedMetaDocumentInputDTO;
}
