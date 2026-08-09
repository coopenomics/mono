import { Field, Float, InputType, Int, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import type { ExcludeCommonProps } from '~/application/document/types';

/**
 * Подписываемая форма заявления пайщика о гарантийном возврате имущества
 * по ЦПП «Стол заказов» (registry_id=1104, `MarketplaceReturnStatement`).
 *
 * Лежит рядом с 1102 «Акт приёма-передачи» и 1103 «ТТН» в Marketplace по
 * системе членских взносов. Не путать с registry_id=800 — тот документ
 * принадлежит старой системе клиринга и сохранён отдельно как есть.
 *
 * Поле `request.hash` дублирует якорный хеш on-chain `return_request.hash`
 * (он же `request_hash` параметра `marketplace::submretrn`). Backend
 * хеширует детерминированный seed `return:<order_hash>:<orderer>:<actual_
 * quantity>` и кладёт результат в оба места.
 */
type action = Cooperative.Registry.MarketplaceReturnStatement.Action;

@InputType('MarketplaceReturnStatementRequestPayloadInput')
export class MarketplaceReturnStatementRequestPayloadInputDTO {
  @Field({ description: 'Якорный hash заявления на возврат (request_hash).' })
  @IsString()
  hash!: string;

  @Field({ description: 'Заголовок имущества, по которому подаётся возврат.' })
  @IsString()
  title!: string;

  @Field({ description: 'Единица измерения (например «ед.»).' })
  @IsString()
  unit_of_measurement!: string;

  @Field(() => Float, { description: 'Возвращаемое количество единиц.' })
  @IsNumber()
  @Min(1)
  units!: number;

  @Field({ description: 'Стоимость единицы (десятичное число строкой).' })
  @IsString()
  unit_cost!: string;

  @Field({ description: 'Итоговая возвращаемая сумма (десятичное число строкой).' })
  @IsString()
  total_cost!: string;

  @Field({ description: 'Валюта расчёта (например «RUB»).' })
  @IsString()
  currency!: string;

  @Field({ description: 'Тип операции в каноне ICommonRequest (для возврата — «RETURN»).' })
  @IsString()
  type!: string;

  @Field(() => Int, { description: 'Идентификатор программы Стола Заказов в кооперативе.' })
  @IsInt()
  @Min(0)
  program_id!: number;
}

@InputType('BaseMarketplaceReturnStatementMetaDocumentInput')
class BaseMarketplaceReturnStatementMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Идентификатор заказа, по которому подаётся возврат.' })
  @IsString()
  order_id!: string;

  @Field({ description: 'Канонический order_hash on-chain.' })
  @IsString()
  order_hash!: string;

  @Field({ nullable: true, description: 'Имя кооперативного участка доставки (braname) исходного заказа.' })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field({ description: 'Причина обращения, как её сформулировал пайщик.' })
  @IsString()
  reason_text!: string;

  @Field(() => Float, { description: 'Фактическое количество единиц к возврату.' })
  @IsNumber()
  @Min(1)
  actual_quantity!: number;

  @Field({ description: 'Стоимость возвращаемой части (4 знака после запятой).' })
  @IsString()
  fact_cost!: string;

  @Field({ description: 'Артикул (SKU) товара — идентификатор предложения исходного заказа.' })
  @IsString()
  sku!: string;

  @Field({ description: 'Наименование товара из предложения.' })
  @IsString()
  product_title!: string;

  @Field({ description: 'Единица измерения (например «литры», «кг», «шт.»).' })
  @IsString()
  unit_of_measurement!: string;

  @Field({ description: 'Стоимость базовой единицы товара (4 знака после запятой).' })
  @IsString()
  unit_cost!: string;

  @Field({ description: 'Код валюты расчёта (например «RUB»).' })
  @IsString()
  currency!: string;

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

@InputType('MarketplaceReturnStatementGenerateDocumentInput')
export class MarketplaceReturnStatementGenerateDocumentInputDTO
  extends IntersectionType(
    BaseMarketplaceReturnStatementMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType('MarketplaceReturnStatementSignedMetaDocumentInput')
export class MarketplaceReturnStatementSignedMetaDocumentInputDTO
  extends IntersectionType(BaseMarketplaceReturnStatementMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType('MarketplaceReturnStatementSignedInput')
export class MarketplaceReturnStatementSignedInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => MarketplaceReturnStatementSignedMetaDocumentInputDTO, {
    description: 'Метаданные подписанного заявления о гарантийном возврате имущества.',
  })
  @ValidateNested()
  @Type(() => MarketplaceReturnStatementSignedMetaDocumentInputDTO)
  public readonly meta!: MarketplaceReturnStatementSignedMetaDocumentInputDTO;
}
