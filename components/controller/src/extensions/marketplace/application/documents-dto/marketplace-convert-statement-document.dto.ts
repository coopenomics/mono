import { Field, Float, InputType, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsBoolean, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Cooperative } from 'cooptypes';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

/**
 * Подписываемая форма заявления пайщика о конвертации паевого взноса в
 * членский взнос по ЦПП «Стол заказов» (registry_id=1110,
 * `MarketplaceConvertStatement`).
 *
 * Паевая модель (компонент 68): заявление на полную сумму перевода из
 * Цифрового кошелька в программу с выделением членского взноса участка. По
 * кошелькам проходят обе части, каждая своим путём: паевая — по паевым
 * кошелькам (резерв под заказ), членская — по членским (в членский кошелёк
 * программы `w.mkt.member` переходит недостающая до взноса часть, остаток
 * зачитывается автоматически). Уходит on-chain параметром `convert_statement` действий
 * `marketplace::createorder` / `marketplace::stockorder` / `marketplace::issuestmt`;
 * контракт публикует его в реестр документов самостоятельным пакетом
 * (package = hash заявления).
 */
type action = Cooperative.Registry.MarketplaceConvertStatement.Action;

@InputType('BaseMarketplaceConvertStatementMetaDocumentInput')
class BaseMarketplaceConvertStatementMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Канонический order_hash заказа, под который конвертируется взнос.' })
  @IsString()
  order_hash!: string;

  @Field({ description: 'Полная сумма перевода в программу (стоимость имущества вместе с членским взносом), с валютой.' })
  @IsString()
  amount!: string;

  @Field({ description: 'Членский взнос кооперативного участка в составе суммы, с валютой.' })
  @IsString()
  membership_fee!: string;

  @Field({ description: 'Часть взноса, переводимая из паевого в членский по заявлению, с валютой (остальное — зачёт членского кошелька).' })
  @IsString()
  convert_amount!: string;

  @Field(() => Float, { description: 'Ставка членского взноса кооператива, процентов.' })
  @IsNumber()
  fee_percent!: number;

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
