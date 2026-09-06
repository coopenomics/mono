import { Field, Float, InputType, Int, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Cooperative } from 'cooptypes';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

/**
 * Подписываемая форма Акта приёма-передачи имущества в счёт возврата
 * паевого взноса (registry 1115, `MarketplaceShareReturnAct`) — паевая модель.
 *
 * Составляется бэкендом во исполнение протокола совета; первая подпись —
 * заказчика (`issueact1`), закрывающая — председателя, доверенного или
 * оператора участка выдачи (`issueact2`, на агрегат документа заказчика).
 */
type action = Cooperative.Registry.MarketplaceShareReturnAct.Action;

@InputType('BaseMarketplaceShareReturnActMetaDocumentInput')
class BaseMarketplaceShareReturnActMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Идентификатор заказа пайщика.' })
  @IsString()
  order_id!: string;

  @Field({ description: 'Канонический хэш заказа в блокчейне.' })
  @IsString()
  order_hash!: string;

  @Field(() => Int, { description: 'Номер решения совета, во исполнение которого составлен акт.' })
  @IsInt()
  @Min(0)
  decision_id!: number;

  @Field({ description: 'Номер акта для шапки документа.' })
  @IsString()
  act_id!: string;

  @Field({ description: 'Учётная запись передающей стороны — председатель, доверенное лицо или оператор участка выдачи.' })
  @IsString()
  transmitter!: string;

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

@InputType('MarketplaceShareReturnActGenerateDocumentInput')
export class MarketplaceShareReturnActGenerateDocumentInputDTO
  extends IntersectionType(
    BaseMarketplaceShareReturnActMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;
}

@InputType('MarketplaceShareReturnActSignedMetaDocumentInput')
export class MarketplaceShareReturnActSignedMetaDocumentInputDTO
  extends IntersectionType(BaseMarketplaceShareReturnActMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType('MarketplaceShareReturnActSignedInput')
export class MarketplaceShareReturnActSignedInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => MarketplaceShareReturnActSignedMetaDocumentInputDTO, {
    description: 'Метаданные подписанного акта приёма-передачи имущества в счёт возврата паевого взноса.',
  })
  @ValidateNested()
  @Type(() => MarketplaceShareReturnActSignedMetaDocumentInputDTO)
  public readonly meta!: MarketplaceShareReturnActSignedMetaDocumentInputDTO;
}
