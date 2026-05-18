import { Field, InputType, Int, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import type { ExcludeCommonProps } from '~/application/document/types';

/**
 * Story 7.1 (Эпик 7): подписываемая форма заявления пайщика на гарантийный
 * возврат имущества (registry_id=800 «Заявление на возврат паевого взноса
 * имуществом»). Стандарт `p.mkt.return.standard.yaml` секция `documents`
 * допускает переиспользование шаблона 800 для членской модели — структурно
 * совместим (поля `request.hash / title / units / unit_cost / total_cost`
 * заполняются из Order'а).
 *
 * `request.hash` совпадает с `request_hash` параметра `marketplace::submretrn`
 * — он же якорный хеш on-chain `return_request.hash`. Двусторонняя сверка
 * backend ↔ on-chain: backend хеширует детерминированный seed
 * `return:<order_hash>:<orderer>:<actual_quantity>` и кладёт результат в
 * оба места.
 */
type action = Cooperative.Registry.ReturnByAssetStatement.Action;

@InputType('MarketplaceReturnClaimRequestPayloadInput')
export class MarketplaceReturnClaimRequestPayloadInputDTO {
  @Field({ description: 'Якорный hash заявления на возврат (request_hash).' })
  @IsString()
  hash!: string;

  @Field({ description: 'Заголовок имущества, по которому подаётся возврат.' })
  @IsString()
  title!: string;

  @Field({ description: 'Единица измерения (например «ед.»).' })
  @IsString()
  unit_of_measurement!: string;

  @Field(() => Int, { description: 'Возвращаемое количество единиц.' })
  @IsInt()
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

@InputType('BaseMarketplaceReturnClaimMetaDocumentInput')
class BaseMarketplaceReturnClaimMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field(() => MarketplaceReturnClaimRequestPayloadInputDTO, {
    description:
      'Описание возвращаемого имущества — копируется из Order пайщика и используется ' +
      'как якорь возврата (hash совпадает с request_hash в on-chain заявлении).',
  })
  @ValidateNested()
  @Type(() => MarketplaceReturnClaimRequestPayloadInputDTO)
  public request!: MarketplaceReturnClaimRequestPayloadInputDTO;

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

@InputType('MarketplaceReturnClaimGenerateDocumentInput')
export class MarketplaceReturnClaimGenerateDocumentInputDTO
  extends IntersectionType(
    BaseMarketplaceReturnClaimMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType('MarketplaceReturnClaimSignedMetaDocumentInput')
export class MarketplaceReturnClaimSignedMetaDocumentInputDTO
  extends IntersectionType(BaseMarketplaceReturnClaimMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType('MarketplaceReturnClaimSignedStatementInput')
export class MarketplaceReturnClaimSignedStatementInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => MarketplaceReturnClaimSignedMetaDocumentInputDTO, {
    description: 'Метаданные подписанного заявления на возврат имущества.',
  })
  public readonly meta!: MarketplaceReturnClaimSignedMetaDocumentInputDTO;
}
