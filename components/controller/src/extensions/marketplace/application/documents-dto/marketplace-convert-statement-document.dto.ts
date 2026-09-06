import { Field, InputType, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsBoolean, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Cooperative } from 'cooptypes';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

/**
 * Подписываемая форма заявления 1110 о переводе паевого взноса в ЦПП «Стол
 * заказов» (`MarketplaceConvertStatement`): «прошу перевести с баланса моего
 * Цифрового кошелька на баланс ЦПП «Стол заказов» N, из них членский взнос M».
 * Пишется только на недостающую сумму — то, чего не хватает на внутреннем
 * членском кошельке программы, — и уходит on-chain параметром
 * `convert_statement` действия `marketplace::convert` отдельной транзакцией
 * до заказа; контракт переводит членскую часть и публикует заявление в реестр
 * документов самостоятельным пакетом.
 */
type action = Cooperative.Registry.MarketplaceConvertStatement.Action;

@InputType('BaseMarketplaceConvertStatementMetaDocumentInput')
class BaseMarketplaceConvertStatementMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Якорь заявления: хеш оформления, бандла или заказа, к которому относится перевод.' })
  @IsString()
  order_hash!: string;

  @Field({ description: 'Недостающая сумма перевода в программу (паевая и членская части вместе), с валютой.' })
  @IsString()
  amount!: string;

  @Field({ description: 'Членская часть суммы — переводится в членский кошелёк действием convert, с валютой.' })
  @IsString()
  membership_fee!: string;

  @Field({ description: 'Источник перевода: wallet — Цифровой кошелёк, market — свободный паевой Стола заказов.' })
  @IsString()
  source!: 'wallet' | 'market';

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
    description: 'Метаданные подписанного заявления о конвертации паевого взноса в членский.',
  })
  @ValidateNested()
  @Type(() => MarketplaceConvertStatementSignedMetaDocumentInputDTO)
  public readonly meta!: MarketplaceConvertStatementSignedMetaDocumentInputDTO;
}
