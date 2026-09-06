import { Field, Float, InputType, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsBoolean, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Cooperative } from 'cooptypes';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

/**
 * Подписываемая форма Заявления о возврате паевого взноса имуществом
 * (registry 1113, `MarketplaceShareReturnStatement`) — паевая модель выдачи.
 *
 * Генерируется у стойки после сверки факта оператором, подписывается
 * заказчиком одним нажатием и уходит on-chain параметром `statement`
 * действия `marketplace::issuestmt`; контракт ставит его на повестку совета.
 */
type action = Cooperative.Registry.MarketplaceShareReturnStatement.Action;

@InputType('BaseMarketplaceShareReturnStatementMetaDocumentInput')
class BaseMarketplaceShareReturnStatementMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Идентификатор заказа пайщика.' })
  @IsString()
  order_id!: string;

  @Field({ description: 'Канонический хэш заказа в блокчейне.' })
  @IsString()
  order_hash!: string;

  @Field({ nullable: true, description: 'Кооперативный участок выдачи.' })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field({ description: 'Артикул (СКУ) товара по заказу.' })
  @IsString()
  sku!: string;

  @Field({ description: 'Наименование товара по заказу.' })
  @IsString()
  product_title!: string;

  @Field({ description: 'Единица измерения товара (человекочитаемая).' })
  @IsString()
  unit_of_measurement!: string;

  @Field(() => Float, { description: 'Фактически выдаваемое количество единиц.' })
  @IsNumber()
  @Min(0)
  fact_quantity!: number;

  @Field({ description: 'Фактическая цена за единицу отпуска.' })
  @IsString()
  unit_cost!: string;

  @Field({ description: 'Фактическая сумма выдачи.' })
  @IsString()
  total_amount!: string;

  @Field({ description: 'Символ валюты для сумм.' })
  @IsString()
  currency!: string;

  @Field({ nullable: true, description: 'Хэш приватного payload документа (если приватные данные хранятся отдельно).' })
  @IsOptional()
  @IsString()
  doc_data_hash?: string;

  @Field({ description: 'Сформировать документ без сохранения (preview-режим).' })
  @IsBoolean()
  skip_save!: boolean;
}

@InputType('MarketplaceShareReturnStatementGenerateDocumentInput')
export class MarketplaceShareReturnStatementGenerateDocumentInputDTO
  extends IntersectionType(
    BaseMarketplaceShareReturnStatementMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;
}

@InputType('MarketplaceShareReturnStatementSignedMetaDocumentInput')
export class MarketplaceShareReturnStatementSignedMetaDocumentInputDTO
  extends IntersectionType(BaseMarketplaceShareReturnStatementMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType('MarketplaceShareReturnStatementSignedInput')
export class MarketplaceShareReturnStatementSignedInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => MarketplaceShareReturnStatementSignedMetaDocumentInputDTO, {
    description: 'Метаданные подписанного заявления о возврате паевого взноса имуществом.',
  })
  @ValidateNested()
  @Type(() => MarketplaceShareReturnStatementSignedMetaDocumentInputDTO)
  public readonly meta!: MarketplaceShareReturnStatementSignedMetaDocumentInputDTO;
}
