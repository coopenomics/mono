import { Field, InputType, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsBoolean, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Registry } from '@coopenomics/docs-templates';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

/**
 * Подписываемая форма заявления 1110 о трансляции паевого взноса из ЦПП
 * «Цифровой Кошелёк» в ЦПП «Стол заказов» (`MarketplaceConvertStatement`,
 * задача 99D-18). Пишется только на недостающую на свободном паевом «Стола
 * заказов» сумму и передаётся в цепь параметром `convert_statement` действия
 * `marketplace::convert` до заказа; контракт транслирует сумму и публикует
 * заявление в реестр документов самостоятельным пакетом.
 */
type action = Registry.MarketplaceConvertStatement.Action;

@InputType('BaseMarketplaceConvertStatementMetaDocumentInput')
class BaseMarketplaceConvertStatementMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Якорь заявления: хеш оформления, бандла или заказа, к которому относится трансляция.' })
  @IsString()
  order_hash!: string;

  @Field({ description: 'Сумма трансляции из Цифрового кошелька: недостающие части стоимости и обеспечительной части, с валютой.' })
  @IsString()
  amount!: string;

  @Field({ description: 'Обеспечительная часть паевого взноса в сумме трансляции, с валютой.' })
  @IsString()
  membership_fee!: string;

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
    description: 'Метаданные подписанного заявления о трансляции паевого взноса в Стол заказов.',
  })
  @ValidateNested()
  @Type(() => MarketplaceConvertStatementSignedMetaDocumentInputDTO)
  public readonly meta!: MarketplaceConvertStatementSignedMetaDocumentInputDTO;
}
